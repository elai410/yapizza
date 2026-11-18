import { NextResponse } from 'next/server';
import { parseJson, prisma, toNyIso } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Club page data: the intake address and the latest mail with what each one became.
// shortcut: shows every club's mail with no sign-in (demo only); scope to the signed-in host before real use.
export async function GET() {
  const [recent, versions] = await Promise.all([
    prisma.source.findMany({
      // Newest arrival first. receivedAt is the email's own sent date, so an old email sent now would sink; cuid ids sort by creation time.
      orderBy: { id: 'desc' },
      take: 12,
      // Full event rows, not a select: a dev server started before the v1.1 migration has a client without readBy.
      include: { events: true, _count: { select: { listings: true } } },
    }),
    prisma.eventVersion.findMany({ where: { fromSourceId: { not: null } }, include: { event: { select: { title: true } } } }),
  ]);

  const updatesBySource = new Map<string, { id: string; title: string; changedFields: string[] }[]>();
  for (const v of versions) {
    const k = v.fromSourceId as string;
    updatesBySource.set(k, [...(updatesBySource.get(k) ?? []), { id: v.eventId, title: v.event.title, changedFields: parseJson<string[]>(v.changedFields, []) }]);
  }

  return NextResponse.json({
    intake: process.env.GMAIL_INTAKE_ADDRESS || null,
    log: recent.map(function (s) {
      return {
        id: s.id,
        kind: s.kind,
        subject: s.subject,
        from: s.listName ?? s.sender,
        receivedAt: toNyIso(s.receivedAt),
        status: s.status,
        error: s.error,
        rawText: s.rawText.slice(0, 8000),
        listings: s._count.listings,
        created: s.events.map(function (e) {
          return { id: e.id, title: e.title, start: toNyIso(e.start), status: e.status, readBy: e.readBy ?? 'rules', confidence: e.confidence, evidence: parseJson<string[]>(e.evidence, []) };
        }),
        updated: updatesBySource.get(s.id) ?? [],
      };
    }),
  });
}

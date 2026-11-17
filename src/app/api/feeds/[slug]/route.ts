import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { isOn, TAGS, type Tag } from '@/lib/contracts';
import { cardInclude, parseJson, prisma, toCard } from '@/lib/db';
import { toIcs } from '@/lib/calendar';

export const dynamic = 'force-dynamic';

const TAG_NAMES: Record<Tag, string> = {
  free_food: 'Free food',
  cultural: 'Cultural',
  professional: 'Professional',
  academic: 'Academic',
  social: 'Social',
  arts: 'Arts',
  athletics: 'Athletics',
  traditions: 'Traditions',
};

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!isOn('CAL_FEEDS')) return new NextResponse('Not found', { status: 404 });
  const slug = (await ctx.params).slug.replace(/\.ics$/i, '').toLowerCase();

  const where: Prisma.EventWhereInput = {
    status: { in: ['live', 'canceled'] }, // canceled ships as CANCELLED so subscribers see it
    start: { gte: new Date(Date.now() - 30 * 864e5) },
  };
  let calName = 'Yapizza';
  let tag: Tag | null = null;

  if (slug.startsWith('host-')) {
    const host = await prisma.host.findUnique({ where: { id: slug.slice(5) } });
    if (!host) return new NextResponse('Not found', { status: 404 });
    where.hostId = host.id;
    calName = `Yapizza: ${host.name}`;
  } else if (slug !== 'all') {
    const t = slug.replace(/-/g, '_');
    if (!(TAGS as readonly string[]).includes(t)) return new NextResponse('Not found', { status: 404 });
    tag = t as Tag;
    calName = `Yapizza: ${TAG_NAMES[tag]}`;
    if (tag === 'free_food') where.freeFood = true;
  }

  const rows = await prisma.event.findMany({ where, include: cardInclude, orderBy: { start: 'asc' } });
  const events = rows
    .filter((r) => !tag || tag === 'free_food' || parseJson<Tag[]>(r.tags, []).includes(tag))
    .map((r) => ({
      ...toCard(r),
      summary: r.summary,
      locationRaw: r.locationRaw,
      rsvpUrl: r.rsvpUrl,
      updatedAt: r.updatedAt.toISOString(),
    }));

  return new NextResponse(toIcs(events, calName), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="yapizza-${slug}.ics"`,
    },
  });
}

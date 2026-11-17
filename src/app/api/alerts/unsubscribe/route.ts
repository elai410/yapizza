import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isOn, type OkResponse } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// The email the alert went to when given, otherwise the signed-in user.
const Body = z.object({ target: z.string().trim().min(1).max(200).optional() });

export async function POST(req: Request) {
  if (!isOn('ALERTS')) return new NextResponse('Not found', { status: 404 });
  const parsed = Body.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  const target = parsed.data.target?.toLowerCase();
  const u = await adapters.auth().currentUser();
  if (!u && !target) return NextResponse.json({ error: 'target required' }, { status: 400 });

  await prisma.user.updateMany({
    // A given target is exact: it never also turns off the signed-in user's own alerts.
    where: target ? { OR: [{ alertEmail: target }, { netid: `alert:${target}` }] } : { netid: u!.netid },
    data: { alertFreeFood: false },
  });
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

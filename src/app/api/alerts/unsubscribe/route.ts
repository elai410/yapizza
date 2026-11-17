import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isOn, type OkResponse } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Same identity rules as subscribe: the signed-in user, and/or the email the alert went to.
const Body = z.object({ target: z.string().trim().min(1).max(200).optional() });

export async function POST(req: Request) {
  if (!isOn('ALERTS')) return new NextResponse('Not found', { status: 404 });
  const parsed = Body.safeParse((await req.json().catch(() => null)) ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'invalid request' }, { status: 400 });
  const target = parsed.data.target?.toLowerCase();
  const u = await adapters.auth().currentUser();
  if (!u && !target) return NextResponse.json({ error: 'target required' }, { status: 400 });

  await prisma.user.updateMany({
    where: { OR: [...(u ? [{ netid: u.netid }] : []), ...(target ? [{ alertEmail: target }, { netid: `alert:${target}` }] : [])] },
    data: { alertFreeFood: false },
  });
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

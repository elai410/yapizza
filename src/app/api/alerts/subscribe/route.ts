import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isOn, type AlertsSubscribeRequest, type OkResponse } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { prisma } from '@/lib/db';
import { ensureUser } from '@/lib/db/user';

export const dynamic = 'force-dynamic';

const Body = z
  .object({ channel: z.enum(['email', 'sms']), target: z.string().trim().min(1).max(200), freeFood: z.boolean() })
  .refine((b) => b.channel !== 'email' || z.email().safeParse(b.target).success, {
    message: 'enter a valid email',
    path: ['target'],
  });

export async function POST(req: Request) {
  if (!isOn('ALERTS')) return new NextResponse('Not found', { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid request' }, { status: 400 });
  }
  const b: AlertsSubscribeRequest = parsed.data;
  // shortcut: sms targets are stored but only email alerts send; add an sms field when a texting adapter exists.
  const alertEmail = b.channel === 'email' ? b.target.toLowerCase() : undefined;

  const u = await adapters.auth().currentUser();
  if (u) {
    const user = await ensureUser(u);
    await prisma.user.update({ where: { id: user.id }, data: { alertEmail, alertFreeFood: b.freeFood } });
  } else {
    const netid = `alert:${b.target.toLowerCase()}`;
    await prisma.user.upsert({
      where: { netid },
      create: { netid, name: b.target, alertEmail, alertFreeFood: b.freeFood },
      update: { alertEmail, alertFreeFood: b.freeFood },
    });
  }
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

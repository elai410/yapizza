import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isOn, type OkResponse } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { prisma } from '@/lib/db';
import { ensureUser } from '@/lib/db/user';

export const dynamic = 'force-dynamic';

const Body = z.object({ eventId: z.string().min(1) });
const notFound = () => new NextResponse('Not found', { status: 404 });

async function parse(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  return body.success ? body.data : null;
}

export async function GET() {
  if (!isOn('GCAL_INSERT')) return notFound();
  const u = await adapters.auth().currentUser();
  if (!u) return NextResponse.json({ eventIds: [] });
  const saves = await prisma.save.findMany({
    where: { user: { netid: u.netid } },
    select: { eventId: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ eventIds: saves.map((s) => s.eventId) });
}

export async function POST(req: Request) {
  if (!isOn('GCAL_INSERT')) return notFound();
  const body = await parse(req);
  if (!body) return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  const u = await adapters.auth().currentUser();
  if (!u) return NextResponse.json({ error: 'sign in to save' }, { status: 401 });
  const event = await prisma.event.findUnique({ where: { id: body.eventId }, select: { id: true } });
  if (!event) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const user = await ensureUser(u);
  await prisma.save.upsert({
    where: { userId_eventId: { userId: user.id, eventId: event.id } },
    create: { userId: user.id, eventId: event.id },
    update: {},
  });
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

export async function DELETE(req: Request) {
  if (!isOn('GCAL_INSERT')) return notFound();
  const body = await parse(req);
  if (!body) return NextResponse.json({ error: 'eventId required' }, { status: 400 });
  const u = await adapters.auth().currentUser();
  if (!u) return NextResponse.json({ error: 'sign in to save' }, { status: 401 });
  await prisma.save.deleteMany({ where: { eventId: body.eventId, user: { netid: u.netid } } });
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

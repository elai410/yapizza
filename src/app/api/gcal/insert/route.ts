import { adapters } from '@/lib/adapters';
import { isOn } from '@/lib/contracts';
import { getEvent, prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!isOn('GCAL_INSERT')) return Response.json({ error: 'not found' }, { status: 404 });
  const user = await adapters.auth().currentUser();
  if (!user) return Response.json({ error: 'sign in' }, { status: 401 });
  const body: unknown = await req.json().catch(() => null);
  const eventId = body && typeof body === 'object' && 'eventId' in body ? body.eventId : null;
  const event = typeof eventId === 'string' ? await getEvent(eventId) : null;
  if (!event) return Response.json({ error: 'event not found' }, { status: 404 });

  const sink = adapters.calendar();
  const r = await sink.insert(event, user.id);
  const mode = r.link.startsWith('/sim') ? 'sim' : sink.mode;
  await prisma.save.upsert({
    where: { userId_eventId: { userId: user.id, eventId: event.id } },
    create: { userId: user.id, eventId: event.id, gcalEventId: r.externalId },
    update: { gcalEventId: r.externalId },
  });
  return Response.json({ mode, link: r.link });
}

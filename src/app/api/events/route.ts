import { NextResponse, type NextRequest } from 'next/server';
import { isOn, TAGS, type EventsListResponse, type Tag } from '@/lib/contracts';
import { listEvents } from '@/lib/db';

export const dynamic = 'force-dynamic';

function validDate(s: string | null): string | undefined {
  return s && !Number.isNaN(Date.parse(s)) ? s : undefined;
}

export async function GET(req: NextRequest) {
  if (!isOn('FEED')) return new NextResponse('Not found', { status: 404 });
  const p = req.nextUrl.searchParams;
  const serverTime = new Date().toISOString(); // taken before the read so a poll never misses a write
  const tags = (p.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is Tag => (TAGS as readonly string[]).includes(t));
  const events = await listEvents({
    from: validDate(p.get('from')),
    to: validDate(p.get('to')),
    since: validDate(p.get('since')),
    tags: tags.length ? tags : undefined,
    college: p.get('college') || undefined,
    freeFood: p.get('freeFood') === 'true' || p.get('freeFood') === '1',
    q: p.get('q') || undefined,
  });
  const body: EventsListResponse = { events, serverTime };
  return NextResponse.json(body);
}

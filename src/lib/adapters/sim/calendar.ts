import type { CalendarSink, EventDetail } from '@/lib/contracts';

export interface SimCalendarEntry {
  externalId: string;
  userId: string;
  event: EventDetail;
  insertedAt: string;
}

const g = globalThis as unknown as { ypSimCalendar?: SimCalendarEntry[] };
const entries = (g.ypSimCalendar ??= []);

export const simCalendarEntries = () => entries;

export const simCalendar: CalendarSink = {
  mode: 'sim',
  async insert(event, userId) {
    const externalId = 'sim-' + crypto.randomUUID();
    entries.push({ externalId, userId, event, insertedAt: new Date().toISOString() });
    return { externalId, link: '/sim/calendar' };
  },
};

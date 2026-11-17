import type { CalendarSink, EventDetail } from '@/lib/contracts';

export interface SimCalendarEntry {
  externalId: string;
  userId: string;
  event: EventDetail;
  at: string;
}

const g = globalThis as unknown as { ypSimCalendar?: SimCalendarEntry[] };
const entries = (g.ypSimCalendar ??= []);

export const simCalendarEntries = () => entries;

export const simCalendar: CalendarSink = {
  mode: 'sim',
  async insert(event, userId) {
    // Adding the same event twice replaces the entry instead of doubling it.
    const prev = entries.findIndex((e) => e.userId === userId && e.event.id === event.id);
    if (prev >= 0) entries.splice(prev, 1);
    const externalId = 'sim-' + crypto.randomUUID();
    entries.push({ externalId, userId, event, at: new Date().toISOString() });
    return { externalId, link: '/sim/calendar' };
  },
};

export function resetSimCalendar() {
  entries.length = 0;
}

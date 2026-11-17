import { createEvents, type EventAttributes } from 'ics';
import { eventDetails, eventLocation, nextDay, nyDate, timedEnd, type CalendarEventInput } from './gcal-link';

export interface IcsEventInput extends CalendarEventInput {
  id: string;
  status?: string;
  updatedAt?: string;
}

export function toIcs(events: IcsEventInput[], calName: string): string {
  const attrs: EventAttributes[] = events.map((e) => {
    const base = {
      uid: `${e.id}@yapizza`,
      title: e.title,
      description: eventDetails(e) || undefined,
      location: eventLocation(e) ?? undefined,
      url: e.rsvpUrl ?? undefined,
      status: e.status === 'canceled' ? ('CANCELLED' as const) : ('CONFIRMED' as const),
      lastModified: e.updatedAt ? new Date(e.updatedAt).getTime() : undefined,
    };
    return e.allDay
      ? { ...base, start: nyDate(e.start), end: nextDay(nyDate(e.end ?? e.start)) }
      : {
          ...base,
          start: new Date(e.start).getTime(),
          startInputType: 'utc' as const,
          startOutputType: 'utc' as const,
          end: timedEnd(e.start, e.end).getTime(),
          endInputType: 'utc' as const,
          endOutputType: 'utc' as const,
        };
  });
  const { error, value } = createEvents(attrs, { calName, productId: 'yapizza' });
  if (error || value === null) throw error ?? new Error('ics: empty output');
  return value;
}

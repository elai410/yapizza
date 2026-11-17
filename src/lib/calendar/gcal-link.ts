import { formatInTimeZone } from 'date-fns-tz';

export const TZ = 'America/New_York';

export interface CalendarEventInput {
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  summary?: string | null;
  locationRaw?: string | null;
  placeName?: string | null;
  rsvpUrl?: string | null;
}

/** Calendar date of an instant in New York, as [y, m, d]. */
export function nyDate(iso: string): [number, number, number] {
  const [y, m, d] = formatInTimeZone(new Date(iso), TZ, 'yyyy-M-d').split('-').map(Number);
  return [y, m, d];
}

/** Next calendar day, as [y, m, d]. */
export function nextDay([y, m, d]: [number, number, number]): [number, number, number] {
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
}

/** End instant for timed events: given end, or start + 1 hour. */
export function timedEnd(start: string, end: string | null): Date {
  return end ? new Date(end) : new Date(new Date(start).getTime() + 36e5);
}

export function eventDetails(e: Pick<CalendarEventInput, 'summary' | 'rsvpUrl'>): string {
  return [e.summary, e.rsvpUrl ? `RSVP: ${e.rsvpUrl}` : null].filter(Boolean).join('\n\n');
}

export function eventLocation(e: Pick<CalendarEventInput, 'locationRaw' | 'placeName'>): string | null {
  return e.placeName ?? e.locationRaw ?? null;
}

const ymd = ([y, m, d]: [number, number, number]) =>
  `${y}${String(m).padStart(2, '0')}${String(d).padStart(2, '0')}`;
const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function gcalTemplateUrl(e: CalendarEventInput): string {
  const dates = e.allDay
    ? `${ymd(nyDate(e.start))}/${ymd(nextDay(nyDate(e.end ?? e.start)))}`
    : `${utcStamp(new Date(e.start))}/${utcStamp(timedEnd(e.start, e.end))}`;
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates });
  const details = eventDetails(e);
  if (details) p.set('details', details);
  const location = eventLocation(e);
  if (location) p.set('location', location);
  p.set('ctz', TZ);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

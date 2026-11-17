import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays } from 'date-fns';

export const TZ = 'America/New_York';

// "Thu, Dec 4 · 6:00 PM", or "Thu, Dec 4 · All day"
export function formatWhen(start: string, allDay = false): string {
  const day = formatInTimeZone(start, TZ, 'EEE, MMM d');
  return allDay ? `${day} · All day` : `${day} · ${formatInTimeZone(start, TZ, 'h:mm a')}`;
}

// "6:00 PM" or "6:00 to 7:30 PM"
export function formatTime(start: string, end: string | null, allDay = false): string {
  if (allDay) return 'All day';
  const s = formatInTimeZone(start, TZ, 'h:mm a');
  if (!end) return s;
  const e = formatInTimeZone(end, TZ, 'h:mm a');
  return s.slice(-2) === e.slice(-2) ? `${s.slice(0, -3)} to ${e}` : `${s} to ${e}`;
}

// "Tue, Nov 17" day key for grouping, in New York time.
export function dayKey(iso: string): string {
  return formatInTimeZone(iso, TZ, 'yyyy-MM-dd');
}

export function dayLabel(key: string, now = new Date()): string {
  const today = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
  const tomorrow = formatInTimeZone(addDays(now, 1), TZ, 'yyyy-MM-dd');
  if (key === today) return 'Today';
  if (key === tomorrow) return 'Tomorrow';
  return formatInTimeZone(fromZonedTime(`${key}T12:00:00`, TZ), TZ, 'EEEE, MMM d');
}

export type Range = 'today' | 'week';

// today = rest of today; week = start of today through 7 days out. NY midnight boundaries.
export function rangeFor(range: Range, now = new Date()): { from: string; to: string } {
  const todayKey = formatInTimeZone(now, TZ, 'yyyy-MM-dd');
  const startOfToday = fromZonedTime(`${todayKey}T00:00:00`, TZ);
  const days = range === 'today' ? 1 : 7;
  return { from: startOfToday.toISOString(), to: addDays(startOfToday, days).toISOString() };
}

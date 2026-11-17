import Link from 'next/link';
import { DEMO_STUDENTS } from '@/lib/adapters/demo-students';
import { getGoogleUser } from '@/lib/adapters/live/google-users';
import { simCalendarEntries } from '@/lib/adapters/sim/calendar';
import { TZ, nyDate } from '@/lib/calendar/gcal-link';

export const dynamic = 'force-dynamic';

type Ymd = [number, number, number];

const utc = ([y, m, d]: Ymd) => new Date(Date.UTC(y, m - 1, d));
const toYmd = (t: Date): Ymd => [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()];
const key = (d: Ymd) => utc(d).toISOString().slice(0, 10);
const addDays = (d: Ymd, n: number) => toYmd(new Date(utc(d).getTime() + n * 864e5));

/** Monday of the week containing d. */
function monday(d: Ymd): Ymd {
  return addDays(d, -((utc(d).getUTCDay() + 6) % 7));
}

function parseWeek(s: string | undefined): Ymd {
  const m = s?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : nyDate(new Date().toISOString());
}

const dayLabel = (d: Ymd) =>
  utc(d).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const who = (userId: string) =>
  DEMO_STUDENTS.find((s) => s.id === userId)?.name ?? getGoogleUser(userId)?.user.name ?? userId;

export default async function SimCalendarPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const start = monday(parseWeek((await searchParams).week));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const entries = [...simCalendarEntries()].sort((a, b) => a.event.start.localeCompare(b.event.start));
  const byDay = (d: Ymd) => entries.filter((e) => key(nyDate(e.event.start)) === key(d));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Simulated calendar</h1>
        <nav className="flex gap-4 text-sm text-muted">
          <Link className="hover:text-ink" href={`/sim/calendar?week=${key(addDays(start, -7))}`}>
            Previous week
          </Link>
          <Link className="hover:text-ink" href="/sim/calendar">
            This week
          </Link>
          <Link className="hover:text-ink" href={`/sim/calendar?week=${key(addDays(start, 7))}`}>
            Next week
          </Link>
        </nav>
      </div>
      <p className="text-sm text-muted">
        {dayLabel(days[0])} to {dayLabel(days[6])} · {entries.length} added in total
      </p>

      <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line text-sm md:grid-cols-7">
        {days.map((d) => {
          const list = byDay(d);
          return (
            <li key={key(d)} className="min-h-32 space-y-2 bg-surface p-2">
              <h2 className="text-xs font-medium text-muted">{dayLabel(d)}</h2>
              {list.length === 0 ? null : (
                <ul className="space-y-2">
                  {list.map(({ externalId, event, userId }) => (
                    <li key={externalId} className="rounded-md bg-accent-soft px-2 py-1.5">
                      <p className="tabular-nums text-faint">{event.allDay ? 'All day' : time(event.start)}</p>
                      <p className="font-medium text-ink">{event.title}</p>
                      {event.placeName ?? event.locationRaw ? (
                        <p className="text-muted">{event.placeName ?? event.locationRaw}</p>
                      ) : null}
                      <p className="text-faint">{who(userId)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

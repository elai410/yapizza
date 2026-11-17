'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { EventCard } from '@/lib/contracts';
import type { HostSummary, MyHost } from '@/lib/db/host';
import { TZ, formatWhen, rangeFor, useSession } from '@/lib/client';
import { Button, Card, EmptyState, Input, Skeleton, StatusBadge, buttonClasses, toast } from '@/components/ui';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

// Sends JSON and returns the API's error text on failure, null on success.
async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.error ?? 'Something went wrong.';
}

const toLocalInput = (iso: string) => formatInTimeZone(iso, TZ, "yyyy-MM-dd'T'HH:mm");
const fromLocalInput = (value: string) => fromZonedTime(value, TZ).toISOString();

export function HostDashboard() {
  const { user, students, signIn, signOut, isLoading } = useSession();
  const { data, mutate } = useSWR<{ hosts: MyHost[] }>(user ? `/api/host/me?u=${user.id}` : null, getJson);

  if (isLoading) return <Skeleton className="mt-6 h-32" />;
  if (!user) return <SignIn students={students} signIn={signIn} />;

  return (
    <div className="mt-6 space-y-10">
      {!data ? (
        <Skeleton className="h-32" />
      ) : data.hosts.length === 0 ? (
        <ClaimClub onClaimed={() => mutate()} />
      ) : (
        data.hosts.map((h) => <HostSection key={h.id} host={h} onChange={() => mutate()} />)
      )}
      <Button variant="ghost" size="sm" className="-ml-3" onClick={() => signOut()}>
        Sign out
      </Button>
    </div>
  );
}

function SignIn({ students, signIn }: { students: { id: string; name: string; college: string | null }[]; signIn: (id: string) => Promise<void> }) {
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const selected = id || students[0]?.id || '';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await signIn(selected);
    } catch {
      toast('Could not sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 max-w-sm p-5">
      <h2 className="text-base font-semibold text-ink">Sign in</h2>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <select
          aria-label="Student"
          value={selected}
          onChange={(e) => setId(e.target.value)}
          className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink"
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.college ? `${s.name}, ${s.college}` : s.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="primary" disabled={busy || !selected}>
          Sign in
        </Button>
      </form>
    </Card>
  );
}

function ClaimClub({ onClaimed }: { onClaimed: () => void }) {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const { data } = useSWR<{ hosts: HostSummary[] }>(`/api/host/hosts?q=${encodeURIComponent(debounced)}`, getJson);

  async function claim(hostId: string) {
    setError(null);
    const err = await send('/api/host/claim', 'POST', { hostId });
    if (err) setError(err);
    else onClaimed();
  }

  return (
    <section>
      <h2 className="text-base font-semibold text-ink">Claim club</h2>
      <Input className="mt-3" type="search" aria-label="Search clubs" placeholder="Club name" value={q} onChange={(e) => setQ(e.target.value)} />
      {error ? <p className="mt-2 text-sm text-muted">{error}</p> : null}
      {data && data.hosts.length === 0 ? <EmptyState>No clubs match.</EmptyState> : null}
      {data && data.hosts.length > 0 ? (
        <Card className="mt-3 divide-y divide-line">
          {data.hosts.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="truncate text-[15px] text-ink">{h.name}</span>
              <Button size="sm" onClick={() => claim(h.id)}>
                Claim club
              </Button>
            </div>
          ))}
        </Card>
      ) : null}
    </section>
  );
}

function HostSection({ host, onChange }: { host: MyHost; onChange: () => void }) {
  const from = rangeFor('week').from;
  const upcoming = host.events.filter((e) => e.event.start >= from || (e.event.end ?? '') >= from);
  const { events, views, saves } = host.totals;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

  return (
    <section>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-ink">{host.name}</h2>
          <p className="tnum mt-0.5 text-sm text-muted">
            {plural(events, 'event')} · {plural(views, 'view')} · {plural(saves, 'save')}
          </p>
        </div>
        <Link href="/host/upload" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
          Upload flyer
        </Link>
      </div>
      <h3 className="mt-6 text-sm font-medium text-muted">Your events</h3>
      {upcoming.length === 0 ? (
        <EmptyState>No upcoming events.</EmptyState>
      ) : (
        <Card className="mt-2 divide-y divide-line">
          {upcoming.map((e) => (
            <EventRow key={e.event.id} event={e.event} onChange={onChange} />
          ))}
        </Card>
      )}
    </section>
  );
}

function EventRow({ event, onChange }: { event: EventCard; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const badge = event.status === 'canceled' ? 'canceled' : event.status === 'review' ? 'review' : event.updatedFields.length ? 'updated' : null;

  async function cancel() {
    if (!confirming) {
      setConfirming(true);
      timer.current = setTimeout(() => setConfirming(false), 3000);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setConfirming(false);
    const err = await send(`/api/host/events/${event.id}/cancel`, 'POST');
    if (err) return toast(err);
    toast('Event canceled');
    onChange();
  }

  if (editing) return <EditForm event={event} onDone={(saved) => { setEditing(false); if (saved) onChange(); }} />;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="tnum text-[13px] text-muted">{formatWhen(event.start, event.allDay)}</p>
        <p className="truncate text-[15px] font-medium text-ink">{event.title}</p>
        {event.placeName ? <p className="truncate text-sm text-muted">{event.placeName}</p> : null}
      </div>
      {badge ? <StatusBadge kind={badge} /> : null}
      {event.status !== 'canceled' ? (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={cancel} className={confirming ? 'text-cancel hover:text-cancel' : undefined}>
            {confirming ? 'Confirm cancel' : 'Cancel event'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EditForm({ event, onDone }: { event: EventCard; onDone: (saved: boolean) => void }) {
  const [title, setTitle] = useState(event.title);
  const [place, setPlace] = useState(event.placeName ?? '');
  const [start, setStart] = useState(toLocalInput(event.start));
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    const patch: Record<string, string | null> = {};
    if (title.trim() !== event.title) patch.title = title.trim();
    if (place.trim() !== (event.placeName ?? '')) {
      // Seed rows keep the short name in placeId; set both so the card label follows.
      patch.placeId = place.trim() || null;
      patch.locationRaw = place.trim() || null;
    }
    if (start && start !== toLocalInput(event.start)) {
      patch.start = fromLocalInput(start);
      // Keep the duration when the start moves.
      if (event.end) patch.end = new Date(Date.parse(event.end) + Date.parse(patch.start) - Date.parse(event.start)).toISOString();
    }
    if (Object.keys(patch).length === 0) return onDone(false);
    setBusy(true);
    const err = await send(`/api/host/events/${event.id}`, 'PATCH', patch);
    setBusy(false);
    if (err) return void toast(err);
    toast('Event updated');
    onDone(true);
  }

  return (
    <form onSubmit={save} className="grid gap-2 px-4 py-3 sm:grid-cols-2">
      <Input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required className="sm:col-span-2" />
      <Input aria-label="Place" placeholder="Place" value={place} onChange={(e) => setPlace(e.target.value)} />
      <Input aria-label="Start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} required className="tnum" />
      <div className="flex gap-1 sm:col-span-2">
        <Button type="submit" variant="primary" size="sm" disabled={busy}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onDone(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

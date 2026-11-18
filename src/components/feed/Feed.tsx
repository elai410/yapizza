'use client';

import { useEffect, useRef, useState } from 'react';
import type { EventCard as EventCardData } from '@/lib/contracts';
import { dayKey, dayLabel, DEFAULT_FILTERS, useEvents, type FeedFilters } from '@/lib/client';
import { EventSheet } from '@/components/event/EventSheet';
import { Button, Card, EmptyState, Enter, EnterList, Skeleton, cn, toast } from '@/components/ui';
import { Slice } from '@/components/brand/Slice';
import { EventCard } from './EventCard';
import { FilterBar } from './FilterBar';
import { AlertsOptIn } from './AlertsOptIn';
import { AskBox } from '@/components/ask/AskBox';

function groupByDay(events: EventCardData[]): [string, EventCardData[]][] {
  const groups = new Map<string, EventCardData[]>();
  for (const e of events) {
    const k = dayKey(e.start);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups];
}

// Ids of cards that are new or changed since the last poll for the same filters. Each stays marked ~1.8s.
function useArrivals(events: EventCardData[] | undefined, key: string): Set<string> {
  const prev = useRef<{ key: string; sigs: Map<string, string> } | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(function () {
    if (!events) return;
    const sigs = new Map(events.map(function (e) { return [e.id, JSON.stringify(e)] as const; }));
    const p = prev.current;
    prev.current = { key, sigs };
    if (!p || p.key !== key) return;
    const changedEvents = events.filter(function (e) { return p.sigs.get(e.id) !== sigs.get(e.id); });
    const changed = changedEvents.map(function (e) { return e.id; });
    if (!changed.length) return;
    changedEvents.slice(0, 3).forEach(function (e) {
      toast((p.sigs.has(e.id) ? 'Updated: ' : 'New event: ') + e.title);
    });
    setFresh(function (s) { return new Set([...s, ...changed]); });
    setTimeout(function () {
      setFresh(function (s) { const n = new Set(s); changed.forEach(function (id) { n.delete(id); }); return n; });
    }, 1800);
  }, [events, key]);
  return fresh;
}

export function Feed() {
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const { events, error, retry } = useEvents(filters);
  const arrived = useArrivals(events, JSON.stringify(filters));
  const filtered = filters.freeFood || filters.tags.length > 0 || filters.college !== null || Boolean(filters.q);

  let body: React.ReactNode;
  if (error && !events) {
    body = <EmptyState action={<Button onClick={function () { void retry(); }}>Try again</Button>}>Couldn&apos;t load events.</EmptyState>;
  } else if (!events) {
    body = (
      <Card aria-busy="true" aria-label="Loading events" className="divide-y divide-line">
        {Array.from({ length: 6 }, function (_, i) {
          return (
            <div key={i} className="flex gap-4 px-4 py-3">
              <Skeleton className="h-4 w-20 shrink-0" />
              <span className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </span>
            </div>
          );
        })}
      </Card>
    );
  } else if (events.length === 0) {
    const msg = filtered
      ? 'No events match these filters.'
      : filters.range === 'today' ? 'Nothing on the calendar today.' : 'Nothing on the calendar this week.';
    body = <EmptyState data-testid="empty-state">{msg}</EmptyState>;
  } else {
    body = groupByDay(events).map(function ([key, group]) {
      const label = dayLabel(key);
      return (
        <section key={key} className="mt-8 first:mt-0">
          {/* Sticky under the header; Today blue, the next day tomato, later days ink. */}
          <h2 className="sticky top-[var(--header-h)] z-10 -mx-1 bg-bg px-1 py-2">
            <span className={cn('inline-block rounded-full px-3 py-1 font-display text-sm font-semibold', label === 'Today' ? 'bg-accent text-white' : label === 'Tomorrow' ? 'bg-sauce text-white' : 'bg-ink text-bg')}>
              {label}
            </span>
          </h2>
          <div className="mt-2 space-y-3">
            <EnterList>
              {group.map(function (e, i) {
                return (
                  <Enter key={e.id} index={i}>
                    <Card interactive><EventCard event={e} onOpen={setOpenId} arrived={arrived.has(e.id)} /></Card>
                  </Enter>
                );
              })}
            </EnterList>
          </div>
        </section>
      );
    });
  }

  const food = events ? events.filter(function (e) { return e.freeFood && e.status !== 'canceled'; }).length : null;

  return (
    <>
      <div className="mb-6 overflow-hidden rounded-lg border-2 border-ink bg-surface shadow-pop">
        <div className="flex items-center gap-4 p-5">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold text-ink sm:text-3xl">What&apos;s on at Yale</h1>
            <p className="tnum mt-1 text-sm text-muted">
              {events ? `${events.length} ${filters.range === 'today' ? 'today' : 'this week'} · ${food} with free food` : '\u00a0'}
            </p>
          </div>
          <Slice className="size-14 shrink-0 sm:size-16" />
        </div>
        <div aria-hidden className="checker h-2" />
      </div>
      <div className="mb-6"><AskBox onOpen={setOpenId} examples={false} /></div>
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="mt-6">{body}</div>
      <div className="mt-8"><AlertsOptIn onOpen={setOpenId} /></div>
      <EventSheet id={openId} onClose={function () { setOpenId(null); }} />
    </>
  );
}

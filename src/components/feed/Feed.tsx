'use client';

import { useState } from 'react';
import type { EventCard as EventCardData } from '@/lib/contracts';
import { dayKey, dayLabel, DEFAULT_FILTERS, useEvents, type FeedFilters } from '@/lib/client';
import { EventSheet } from '@/components/event/EventSheet';
import { EventCard } from './EventCard';
import { FilterBar } from './FilterBar';

function groupByDay(events: EventCardData[]): [string, EventCardData[]][] {
  const groups = new Map<string, EventCardData[]>();
  for (const e of events) {
    const k = dayKey(e.start);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  return [...groups];
}

export function Feed() {
  const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
  const [openId, setOpenId] = useState<string | null>(null);
  const { events, error } = useEvents(filters);
  const filtered = filters.freeFood || filters.tags.length > 0 || filters.college !== null || Boolean(filters.q);

  let body: React.ReactNode;
  if (error && !events) {
    body = <p className="py-10 text-sm text-zinc-500">Events could not be loaded.</p>;
  } else if (!events) {
    body = (
      <ul aria-busy="true" aria-label="Loading events" className="divide-y divide-zinc-100">
        {Array.from({ length: 6 }, function (_, i) {
          return (
            <li key={i} className="flex gap-4 px-2 py-3 animate-pulse motion-reduce:animate-none">
              <span className="h-4 w-28 shrink-0 rounded bg-zinc-100" />
              <span className="flex-1 space-y-2">
                <span className="block h-4 w-2/3 rounded bg-zinc-100" />
                <span className="block h-3 w-1/3 rounded bg-zinc-100" />
              </span>
            </li>
          );
        })}
      </ul>
    );
  } else if (events.length === 0) {
    const msg = filtered
      ? 'No events match these filters.'
      : filters.range === 'today' ? 'Nothing on the calendar today.' : 'Nothing on the calendar this week.';
    body = <p className="py-10 text-sm text-zinc-500">{msg}</p>;
  } else {
    body = groupByDay(events).map(function ([key, group]) {
      return (
        <section key={key} className="mt-6 first:mt-0">
          <h2 className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{dayLabel(key)}</h2>
          <ul className="divide-y divide-zinc-100">
            {group.map(function (e) {
              return <li key={e.id}><EventCard event={e} onOpen={setOpenId} /></li>;
            })}
          </ul>
        </section>
      );
    });
  }

  return (
    <>
      <FilterBar filters={filters} onChange={setFilters} />
      <div className="mt-6">{body}</div>
      <EventSheet id={openId} onClose={function () { setOpenId(null); }} />
    </>
  );
}

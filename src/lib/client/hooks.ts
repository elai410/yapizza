'use client';

import { useEffect, useRef } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import type { EventCard, EventDetail, EventsListResponse, EventsQuery, Tag } from '@/lib/contracts';
import { isOn } from '@/lib/contracts';
import { FIXTURE_EVENTS } from './fixtures';
import { rangeFor, type Range } from './format';

export const USE_FIXTURES = process.env.NEXT_PUBLIC_DATA === 'fixtures';

export type FeedFilters = { range: Range; tags: Tag[]; freeFood: boolean; college: string | null; q?: string };

export const DEFAULT_FILTERS: FeedFilters = { range: 'week', tags: [], freeFood: false, college: null };

export function toQuery(f: FeedFilters, now = new Date()): EventsQuery {
  const { from, to } = rangeFor(f.range, now);
  const q: EventsQuery = { from, to };
  if (f.tags.length) q.tags = f.tags.join(',');
  if (f.freeFood) q.freeFood = 'true';
  if (f.college) q.college = f.college;
  if (f.q) q.q = f.q;
  return q;
}

// Same semantics the api applies server side, so fixtures mode behaves like the real thing.
export function filterEvents<T extends EventCard>(events: T[], q: EventsQuery): T[] {
  const tags = q.tags ? q.tags.split(',') : [];
  const needle = q.q?.toLowerCase();
  return events
    .filter(function (e) {
      const t = new Date(e.start).getTime();
      if (q.from && t < new Date(q.from).getTime()) return false;
      if (q.to && t >= new Date(q.to).getTime()) return false;
      if (tags.length && !tags.some(function (tag) { return e.tags.includes(tag as Tag); })) return false;
      if (q.freeFood === 'true' && !e.freeFood) return false;
      if (q.college && e.college !== q.college) return false;
      if (needle && ![e.title, e.hostName, e.placeName].some(function (s) { return s?.toLowerCase().includes(needle); })) return false;
      return true;
    })
    .sort(function (a, b) { return a.start.localeCompare(b.start); });
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json() as Promise<T>;
}

// Folds a ?since= delta into the list: changed events replace their old copy, new ones are added.
// shortcut: an event edited so it no longer matches the filters stays until the next full load (filter change or reload).
export function mergeDelta(prev: EventsListResponse, delta: EventsListResponse): EventsListResponse {
  const byId = new Map(prev.events.map(function (e) { return [e.id, e] as const; }));
  for (const e of delta.events) byId.set(e.id, e);
  const events = [...byId.values()].sort(function (a, b) { return Date.parse(a.start) - Date.parse(b.start); });
  return { events, serverTime: delta.serverTime };
}

export function useEvents(filters: FeedFilters) {
  // Minute-rounded "now" keeps the SWR key stable between renders.
  const now = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const query = toQuery(filters, now);
  const key = '/api/events?' + new URLSearchParams(query as Record<string, string>);
  const { data, error, isLoading, mutate } = useSWR<EventsListResponse>(key, function () {
    return USE_FIXTURES
      ? Promise.resolve({ events: filterEvents(FIXTURE_EVENTS, query), serverTime: new Date().toISOString() })
      : getJson<EventsListResponse>(key);
  }, { keepPreviousData: true, revalidateOnFocus: false });

  // Live updates (contract 8.3): every 3s ask only for what changed since the last serverTime.
  const latest = useRef(data);
  latest.current = data;
  const live = isOn('LIVE_UPDATES') && !USE_FIXTURES;
  useEffect(function () {
    if (!live) return;
    let busy = false;
    const timer = setInterval(async function () {
      const prev = latest.current;
      if (busy || !prev) return;
      busy = true;
      try {
        const delta = await getJson<EventsListResponse>(key + '&since=' + encodeURIComponent(prev.serverTime));
        if (latest.current !== prev) return; // a full load landed meanwhile
        await mutate(mergeDelta(prev, delta), { revalidate: false });
        // An open detail sheet shows the changed event, so refresh it too.
        delta.events.forEach(function (e) { void globalMutate('/api/events/' + e.id); });
      } catch {
        // Next tick retries; the list keeps what it has.
      } finally {
        busy = false;
      }
    }, 3000);
    return function () { clearInterval(timer); };
  }, [key, live, mutate]);

  return { events: data?.events, serverTime: data?.serverTime, error, isLoading, retry: function () { return mutate(); } };
}

export function useEvent(id: string | null) {
  const { data, error, isLoading } = useSWR<EventDetail>(id ? `/api/events/${id}` : null, function (url: string) {
    if (!USE_FIXTURES) return getJson<EventDetail>(url);
    const e = FIXTURE_EVENTS.find(function (x) { return x.id === id; });
    return e ? Promise.resolve(e) : Promise.reject(new Error('404'));
  });
  return { event: data, error, isLoading };
}

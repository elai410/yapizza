'use client';

import useSWR from 'swr';
import type { EventCard, EventDetail, EventsListResponse, EventsQuery, Tag } from '@/lib/contracts';
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

export function useEvents(filters: FeedFilters) {
  // Minute-rounded "now" keeps the SWR key stable between renders.
  const now = new Date(Math.floor(Date.now() / 60_000) * 60_000);
  const query = toQuery(filters, now);
  const key = '/api/events?' + new URLSearchParams(query as Record<string, string>);
  const { data, error, isLoading } = useSWR<EventsListResponse>(key, function () {
    return USE_FIXTURES
      ? Promise.resolve({ events: filterEvents(FIXTURE_EVENTS, query), serverTime: new Date().toISOString() })
      : getJson<EventsListResponse>(key);
  }, { keepPreviousData: true });
  return { events: data?.events, serverTime: data?.serverTime, error, isLoading };
}

export function useEvent(id: string | null) {
  const { data, error, isLoading } = useSWR<EventDetail>(id ? `/api/events/${id}` : null, function (url: string) {
    if (!USE_FIXTURES) return getJson<EventDetail>(url);
    const e = FIXTURE_EVENTS.find(function (x) { return x.id === id; });
    return e ? Promise.resolve(e) : Promise.reject(new Error('404'));
  });
  return { event: data, error, isLoading };
}

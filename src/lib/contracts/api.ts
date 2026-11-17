import type { EventCard, IntegrationMode } from './types';

// Route table from CLAUDE.md Section 8.3.
export const ROUTES = [
  { method: 'GET', path: '/api/integrations/status', owner: 'integrations', input: 'none', output: 'IntegrationStatus', cp: 0 },
  { method: 'GET', path: '/api/events', owner: 'api', input: 'from, to, tags (csv), college, freeFood, q, since', output: '{ events: EventCard[], serverTime }', cp: 1 },
  { method: 'GET', path: '/api/events/[id]', owner: 'api', input: 'none', output: 'EventDetail', cp: 1 },
  { method: 'GET/POST', path: '/api/auth/*', owner: 'integrations', input: 'sim student picker, Google sign-in', output: 'SessionUser', cp: 1 },
  { method: 'POST', path: '/api/ingest/email', owner: 'pipeline', input: 'RawEmail', output: 'IngestResult', cp: 2 },
  { method: 'POST', path: '/api/upload', owner: 'pipeline', input: 'multipart file, optional hostName', output: 'IngestResult', cp: 2 },
  { method: 'POST', path: '/api/demo/[action]', owner: 'integrations', input: 'send-email, room-change, cancel, free-food-now, reset', output: '{ ok, detail }', cp: 2 },
  { method: 'POST', path: '/api/ask', owner: 'api', input: '{ q }', output: 'AskResponse', cp: 3 },
  { method: 'GET', path: '/api/feeds/[slug].ics', owner: 'api', input: 'slug: all, free-food, a tag, host-<id>', output: 'text/calendar', cp: 4 },
  { method: 'POST', path: '/api/saves', owner: 'api', input: '{ eventId }', output: '{ ok }', cp: 4 },
  { method: 'POST', path: '/api/gcal/insert', owner: 'integrations', input: '{ eventId }', output: '{ mode, link }', cp: 4 },
  { method: 'POST', path: '/api/alerts/subscribe', owner: 'api', input: '{ channel, target, freeFood }', output: '{ ok }', cp: 4 },
  { method: 'GET', path: '/api/digest/preview', owner: 'api', input: 'optional userId', output: '{ subject, html, eventIds }', cp: 4 },
  { method: 'GET', path: '/api/listings', owner: 'api', input: 'none', output: 'lists', cp: 5 },
  { method: 'GET', path: '/api/traditions', owner: 'api', input: 'none', output: 'lists', cp: 5 },
  { method: '*', path: '/api/host/*', owner: 'api', input: 'claim, my events, edit, cancel', output: 'varies', cp: 5 },
] as const;

export type EventsListResponse = { events: EventCard[]; serverTime: string };

export type EventsQuery = {
  from?: string;
  to?: string;
  tags?: string;
  college?: string;
  freeFood?: string;
  q?: string;
  since?: string;
};

export type DemoAction = 'send-email' | 'room-change' | 'cancel' | 'free-food-now' | 'reset';
export type DemoActionResponse = { ok: boolean; detail: string };

export type AskRequest = { q: string };
export type SavesRequest = { eventId: string };
export type OkResponse = { ok: boolean };

export type GcalInsertRequest = { eventId: string };
export type GcalInsertResponse = { mode: IntegrationMode; link: string };

export type AlertsSubscribeRequest = { channel: 'email' | 'sms'; target: string; freeFood: boolean };

export type DigestPreviewResponse = { subject: string; html: string; eventIds: string[] };

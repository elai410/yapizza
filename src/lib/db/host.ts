import type { EventCard } from '@/lib/contracts';
import { cardInclude, prisma, toCard } from '@/lib/db';

export interface HostSummary {
  id: string;
  name: string;
  kind: string;
  verified: boolean;
  claimed: boolean;
}

type HostRow = { id: string; name: string; kind: string; verified: boolean; officerNetid: string | null };
const summary = (h: HostRow): HostSummary => ({
  id: h.id,
  name: h.name,
  kind: h.kind,
  verified: h.verified,
  claimed: h.officerNetid !== null,
});

export async function searchHosts(q: string): Promise<HostSummary[]> {
  // SQLite `contains` is case-insensitive for ASCII, which covers club names.
  const rows = await prisma.host.findMany({
    where: q ? { name: { contains: q } } : {},
    orderBy: { name: 'asc' },
    take: 20,
  });
  return rows.map(summary);
}

export async function claimHost(
  hostId: string,
  netid: string,
): Promise<{ ok: true; host: HostSummary } | { ok: false; status: 404 | 409 }> {
  const host = await prisma.host.findUnique({ where: { id: hostId } });
  if (!host) return { ok: false, status: 404 };
  if (host.officerNetid && host.officerNetid !== netid) return { ok: false, status: 409 };
  const updated = await prisma.host.update({ where: { id: hostId }, data: { officerNetid: netid } });
  return { ok: true, host: summary(updated) };
}

export interface HostEvent {
  event: EventCard;
  reach: { views: number; saves: number };
}
export interface MyHost extends HostSummary {
  events: HostEvent[];
  totals: { events: number; views: number; saves: number };
}

export async function myHosts(netid: string): Promise<MyHost[]> {
  const hosts = await prisma.host.findMany({
    where: { officerNetid: netid },
    include: {
      events: { include: { ...cardInclude, _count: { select: { saves: true } } }, orderBy: { start: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });
  return hosts.map((h) => {
    // Totals only: never which students saved.
    const events = h.events.map((e) => ({ event: toCard(e), reach: { views: e.views, saves: e._count.saves } }));
    return {
      ...summary(h),
      events,
      totals: {
        events: events.length,
        views: events.reduce((n, e) => n + e.reach.views, 0),
        saves: events.reduce((n, e) => n + e.reach.saves, 0),
      },
    };
  });
}

export interface EventPatch {
  title?: string;
  start?: string;
  end?: string | null;
  placeId?: string | null;
  locationRaw?: string | null;
  summary?: string;
  rsvpUrl?: string | null;
  freeFood?: boolean;
  food?: string | null;
}

type OwnedResult<T> = { ok: true; value: T } | { ok: false; status: 403 | 404 };

async function ownedEvent(id: string, netid: string) {
  const e = await prisma.event.findUnique({ where: { id }, include: { host: true } });
  if (!e) return { status: 404 as const };
  if (!e.host?.officerNetid || e.host.officerNetid !== netid) return { status: 403 as const };
  return { event: e };
}

// Field names the UI reads in updatedFields.
const FIELD_LABEL: Record<keyof EventPatch, string> = {
  title: 'title',
  start: 'start',
  end: 'end',
  placeId: 'place',
  locationRaw: 'place',
  summary: 'summary',
  rsvpUrl: 'rsvpUrl',
  freeFood: 'freeFood',
  food: 'food',
};

export async function editEvent(id: string, netid: string, patch: EventPatch): Promise<OwnedResult<EventCard>> {
  const owned = await ownedEvent(id, netid);
  if (!owned.event) return { ok: false, status: owned.status };
  const e = owned.event;

  const data: Record<string, unknown> = {};
  const changed = new Set<string>();
  for (const key of Object.keys(patch) as (keyof EventPatch)[]) {
    const raw = patch[key];
    if (raw === undefined) continue;
    const next = (key === 'start' || key === 'end') && raw !== null ? new Date(raw as string) : raw;
    const prev = e[key];
    const same =
      next instanceof Date || prev instanceof Date
        ? (prev as Date | null)?.getTime() === (next as Date | null)?.getTime()
        : prev === next;
    if (same) continue;
    data[key] = next;
    changed.add(FIELD_LABEL[key]);
  }
  if (e.status === 'review') data.status = 'live'; // a host edit is a human check

  if (Object.keys(data).length) {
    await prisma.$transaction([
      prisma.event.update({ where: { id }, data }),
      ...(changed.size
        ? [prisma.eventVersion.create({ data: { eventId: id, changedFields: JSON.stringify([...changed]) } })]
        : []),
    ]);
  }
  const row = await prisma.event.findUniqueOrThrow({ where: { id }, include: cardInclude });
  return { ok: true, value: toCard(row) };
}

export async function cancelEvent(id: string, netid: string): Promise<OwnedResult<null>> {
  const owned = await ownedEvent(id, netid);
  if (!owned.event) return { ok: false, status: owned.status };
  if (owned.event.status !== 'canceled') {
    await prisma.$transaction([
      prisma.event.update({ where: { id }, data: { status: 'canceled' } }),
      prisma.eventVersion.create({ data: { eventId: id, changedFields: JSON.stringify(['status']) } }),
    ]);
  }
  return { ok: true, value: null };
}

import { PrismaClient, type Prisma } from '@prisma/client';
import { formatInTimeZone } from 'date-fns-tz';
import type {
  Audience,
  EventCard,
  EventDetail,
  EventStatus,
  ExtractedEvent,
  ReadBy,
  Tag,
} from '@/lib/contracts';
import { gcalTemplateUrl } from '@/lib/calendar';
import { displayPlace, placeName } from '@/lib/yale';

// One client across Next.js hot reloads.
const g = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') g.prisma = prisma;

const TZ = 'America/New_York';
export function toNyIso(d: Date): string {
  return formatInTimeZone(d, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export const cardInclude = {
  host: true,
  versions: { orderBy: { changedAt: 'desc' }, take: 1 },
} satisfies Prisma.EventInclude;
export type EventRow = Prisma.EventGetPayload<{ include: typeof cardInclude }>;

export function toCard(e: EventRow): EventCard {
  return {
    id: e.id,
    title: e.title,
    start: toNyIso(e.start),
    end: e.end ? toNyIso(e.end) : null,
    allDay: e.allDay,
    placeId: e.placeId,
    // Pipeline stores place slugs ('lc' -> 'LC 102' with the room); the seed stores short names ('WLH 211') that aren't in the list.
    placeName: (placeName(e.placeId) && displayPlace(e.placeId, e.locationRaw)) ?? e.placeId ?? e.locationRaw,
    hostName: e.host?.name ?? null,
    tags: parseJson<Tag[]>(e.tags, []),
    freeFood: e.freeFood,
    food: e.food,
    audience: e.audience as Audience,
    college: e.college,
    status: e.status as EventStatus,
    updatedFields: parseJson<string[]>(e.versions[0]?.changedFields, []),
    createdAt: e.createdAt.toISOString(),
  };
}

export interface EventFilters {
  from?: string;
  to?: string;
  tags?: Tag[];
  college?: string;
  freeFood?: boolean;
  q?: string;
  since?: string; // events created or updated after this instant
  includeReview?: boolean;
}

export async function listEvents(f: EventFilters = {}): Promise<EventCard[]> {
  const where: Prisma.EventWhereInput = {};
  if (!f.includeReview) where.status = { not: 'review' };
  if (f.from || f.to) {
    where.start = {
      ...(f.from ? { gte: new Date(f.from) } : {}),
      ...(f.to ? { lte: new Date(f.to) } : {}),
    };
  }
  if (f.college) where.college = f.college;
  if (f.freeFood) where.freeFood = true;
  if (f.since) where.updatedAt = { gt: new Date(f.since) };

  const rows = await prisma.event.findMany({ where, include: cardInclude, orderBy: { start: 'asc' } });

  // Tags and keywords are filtered in memory: tags are a JSON string and the data set is small.
  const q = f.q?.trim().toLowerCase();
  const words = q ? q.split(/\s+/) : [];
  return rows
    .filter((e) => {
      if (f.tags?.length) {
        const tags = parseJson<Tag[]>(e.tags, []);
        if (!f.tags.some((t) => tags.includes(t))) return false;
      }
      if (words.length) {
        const hay = [e.title, e.summary, e.locationRaw, e.placeId, e.host?.name, e.food].join(' ').toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    })
    .map(toCard);
}

export async function getEvent(id: string): Promise<EventDetail | null> {
  const e = await prisma.event.findUnique({ where: { id }, include: { ...cardInclude, source: true } });
  if (!e) return null;
  const card = toCard(e);
  // Raw read for the same reason as the raw write in saveExtraction.
  const [rb] = await prisma.$queryRaw<{ readBy: string }[]>`SELECT "readBy" FROM "Event" WHERE "id" = ${id}`;
  // The drawer shows the email that last changed the event (a room change), not the first announcement.
  const latestId = e.versions[0]?.fromSourceId;
  const src = (latestId && latestId !== e.sourceId && (await prisma.source.findUnique({ where: { id: latestId } }))) || e.source;
  // Only quotes found in that source, so the drawer never highlights text that isn't there.
  const norm = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').trim();
  const evidence = parseJson<string[]>(e.evidence, []).filter((q) => norm(src.rawText).includes(norm(q)));
  return {
    ...card,
    summary: e.summary,
    locationRaw: e.locationRaw,
    rsvpUrl: e.rsvpUrl,
    confidence: e.confidence,
    evidence,
    readBy: rb?.readBy === 'grok' ? 'grok' : 'rules',
    gcalTemplateUrl: gcalTemplateUrl({ ...card, summary: e.summary, locationRaw: e.locationRaw, rsvpUrl: e.rsvpUrl }),
    source: {
      id: src.id,
      kind: src.kind as EventDetail['source']['kind'],
      subject: src.subject,
      sender: src.sender,
      listName: src.listName,
      receivedAt: src.receivedAt.toISOString(),
      rawText: src.rawText,
    },
  };
}

// Cards by id in the given order; unknown and in-review ids are dropped.
export async function getCards(ids: string[]): Promise<EventCard[]> {
  const rows = await prisma.event.findMany({ where: { id: { in: ids }, status: { not: 'review' } }, include: cardInclude });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.flatMap((id) => {
    const r = byId.get(id);
    return r ? [toCard(r)] : [];
  });
}

export interface SourceInput {
  kind: EventDetail['source']['kind'];
  messageId?: string | null;
  sender?: string | null;
  listName?: string | null;
  subject?: string | null;
  rawText: string;
  fileUrl?: string | null;
  receivedAt?: string | Date;
}

// Pipeline sets status after its evidence and confidence checks; default is live.
export type SaveEvent = ExtractedEvent & { status?: EventStatus };

export interface SaveResult {
  sourceId: string;
  created: EventCard[];
  listings: number;
  inReview: number;
  duplicateSource: boolean; // messageId was already ingested; nothing written
}

export async function saveExtraction(
  source: SourceInput,
  result: { events: SaveEvent[]; flagged: boolean; flagReason: string | null; readBy?: ReadBy },
): Promise<SaveResult> {
  if (source.messageId) {
    const existing = await prisma.source.findUnique({ where: { messageId: source.messageId } });
    if (existing) return { sourceId: existing.id, created: [], listings: 0, inReview: 0, duplicateSource: true };
  }

  return prisma.$transaction(async (tx) => {
    const src = await tx.source.create({
      data: {
        kind: source.kind,
        messageId: source.messageId ?? null,
        sender: source.sender ?? null,
        listName: source.listName ?? null,
        subject: source.subject ?? null,
        rawText: source.rawText,
        fileUrl: source.fileUrl ?? null,
        ...(source.receivedAt ? { receivedAt: new Date(source.receivedAt) } : {}),
        status: result.flagged ? 'skipped' : 'processed',
        error: result.flagged ? result.flagReason : null,
      },
    });
    if (result.flagged) return { sourceId: src.id, created: [], listings: 0, inReview: 0, duplicateSource: false };

    const created: EventCard[] = [];
    let listings = 0;
    let inReview = 0;
    for (const ev of result.events) {
      if (ev.kind === 'listing') {
        await tx.listing.create({
          data: { sourceId: src.id, title: ev.title, price: ev.price, details: ev.summary },
        });
        listings++;
        continue;
      }
      if (!ev.start) continue; // an event without a time can't go on the feed
      const host = ev.hostName
        ? await tx.host.upsert({ where: { name: ev.hostName }, create: { name: ev.hostName }, update: {} })
        : null;
      const status = ev.status ?? 'live';
      if (status === 'review') inReview++;
      const row = await tx.event.create({
        data: {
          sourceId: src.id,
          hostId: host?.id ?? null,
          title: ev.title,
          start: new Date(ev.start),
          end: ev.end ? new Date(ev.end) : null,
          allDay: ev.allDay,
          placeId: ev.placeId,
          locationRaw: ev.locationRaw,
          summary: ev.summary,
          tags: JSON.stringify(ev.tags),
          freeFood: ev.freeFood,
          food: ev.food,
          audience: ev.audience,
          college: ev.college,
          rsvpUrl: ev.rsvpUrl,
          confidence: ev.confidence,
          evidence: JSON.stringify(ev.evidence),
          status,
        },
        include: cardInclude,
      });
      // Raw SQL so a dev server still running the pre-v1.1 Prisma client keeps working without a restart.
      if (result.readBy) await tx.$executeRaw`UPDATE "Event" SET "readBy" = ${result.readBy} WHERE "id" = ${row.id}`;
      created.push(toCard(row));
    }
    return { sourceId: src.id, created, listings, inReview, duplicateSource: false };
  });
}

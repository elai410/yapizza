import type { EventCard, Tag } from '@/lib/contracts';
import { cardInclude, parseJson, prisma, toCard } from '@/lib/db';

export interface ListingItem {
  id: string;
  title: string;
  price: string | null;
  details: string;
  createdAt: string;
  source: { sender: string | null; listName: string | null; subject: string | null };
}

export async function listListings(): Promise<ListingItem[]> {
  const rows = await prisma.listing.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    include: { source: { select: { sender: true, listName: true, subject: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((l) => ({
    id: l.id,
    title: l.title,
    price: l.price,
    details: l.details,
    createdAt: l.createdAt.toISOString(),
    source: l.source,
  }));
}

export interface TraditionItem {
  id: string;
  title: string;
  hostName: string | null;
  typicalMonth: number | null;
  yearsSeen: number[];
  notes: string | null;
  next: EventCard | null;
}

export async function listTraditions(): Promise<TraditionItem[]> {
  const now = new Date();
  const series = await prisma.series.findMany({ where: { isTradition: true } });
  const upcoming = await prisma.event.findMany({
    where: { status: 'live', start: { gte: now } },
    include: cardInclude,
    orderBy: { start: 'asc' },
  });

  const covered = new Set<string>();
  const out: TraditionItem[] = series.map((s) => {
    const title = s.title.toLowerCase();
    const next = upcoming.find((e) => e.seriesId === s.id || e.title.toLowerCase() === title) ?? null;
    if (next) covered.add(next.id);
    return {
      id: s.id,
      title: s.title,
      hostName: s.hostName,
      typicalMonth: s.typicalMonth,
      yearsSeen: parseJson<number[]>(s.yearsSeen, []),
      notes: s.notes,
      next: next ? toCard(next) : null,
    };
  });

  // Fallback until pipeline's detectSeries fills Series: upcoming events tagged traditions.
  for (const e of upcoming) {
    if (covered.has(e.id) || !parseJson<Tag[]>(e.tags, []).includes('traditions')) continue;
    const card = toCard(e);
    out.push({
      id: `event-${e.id}`,
      title: e.title,
      hostName: card.hostName,
      typicalMonth: Number(card.start.slice(5, 7)),
      yearsSeen: [],
      notes: null,
      next: card,
    });
  }

  const key = (t: TraditionItem) => (t.next ? Date.parse(t.next.start) : Infinity);
  return out.sort((a, b) => key(a) - key(b));
}

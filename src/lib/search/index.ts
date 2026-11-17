// Keyword search for Ask Yapizza: the fallback when Grok is unavailable, and the backend of Grok's tools.
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { AskResponse, EventCard, Tag } from '@/lib/contracts';
import { getEvent, listEvents, prisma } from '@/lib/db';
import { COLLEGE_ALIASES } from '@/lib/yale';

const TZ = 'America/New_York';

const TAG_WORDS: Record<string, Tag> = {
  cultural: 'cultural', culture: 'cultural', heritage: 'cultural',
  professional: 'professional', career: 'professional', careers: 'professional', recruiting: 'professional', networking: 'professional', internship: 'professional', internships: 'professional',
  academic: 'academic', lecture: 'academic', lectures: 'academic', seminar: 'academic', talk: 'academic', talks: 'academic',
  social: 'social', party: 'social', parties: 'social', mixer: 'social',
  arts: 'arts', art: 'arts', music: 'arts', concert: 'arts', concerts: 'arts', theater: 'arts', theatre: 'arts', dance: 'arts', film: 'arts',
  athletics: 'athletics', sports: 'athletics', sport: 'athletics', game: 'athletics', games: 'athletics', run: 'athletics',
  traditions: 'traditions', tradition: 'traditions',
};

const STOP = new Set(
  'a an and any anything are at be can do does event events find for from get going happening i in is it me my near of on or show some something the there this to what whats where which who with yale you'.split(' '),
);

/** Midnight in New York, `days` days after the NY calendar date of `now`. */
function nyMidnight(now: Date, days: number): Date {
  const ymd = formatInTimeZone(new Date(now.getTime() + days * 864e5), TZ, 'yyyy-MM-dd');
  return fromZonedTime(`${ymd}T00:00:00`, TZ);
}

export interface ParsedQuery {
  from: Date;
  to: Date | null;
  freeFood: boolean;
  college: string | null;
  tags: Tag[];
  keywords: string[];
  when: string | null;
}

export function parseQuery(q: string, now = new Date()): ParsedQuery {
  let s = ` ${q.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ')} `;
  const take = (re: RegExp) => {
    const hit = re.test(s);
    if (hit) s = s.replace(re, ' ');
    return hit;
  };

  let from = nyMidnight(now, 0);
  let to: Date | null = null;
  let when: string | null = null;
  // Tonight keeps events that started in the last 90 minutes: free food is often still there.
  if (take(/ (tonight|this evening) /)) [from, to, when] = [new Date(now.getTime() - 90 * 6e4), nyMidnight(now, 1), 'Tonight'];
  else if (take(/ today /)) [from, to, when] = [nyMidnight(now, 0), nyMidnight(now, 1), 'Today'];
  else if (take(/ tomorrow( night)? /)) [from, to, when] = [nyMidnight(now, 1), nyMidnight(now, 2), 'Tomorrow'];
  else if (take(/ (this )?weekend /)) {
    const dow = Number(formatInTimeZone(now, TZ, 'i')); // 1 Mon .. 7 Sun
    const fri = dow >= 5 ? 0 : 5 - dow;
    [from, to, when] = [new Date(Math.max(now.getTime(), nyMidnight(now, fri).getTime())), nyMidnight(now, 8 - dow), 'This weekend'];
  } else if (take(/ next week /)) [from, to, when] = [nyMidnight(now, 7), nyMidnight(now, 14), 'Next week'];
  else if (take(/ (this week|week) /)) [from, to, when] = [now, nyMidnight(now, 7), 'This week'];
  if (from.getTime() < nyMidnight(now, 0).getTime()) from = nyMidnight(now, 0);

  const freeFood = take(/ free (food|pizza|lunch|dinner|breakfast|snacks?|boba|coffee) /) || take(/ (food|eat|eating|snacks) /);

  let college: string | null = null;
  for (const alias of Object.keys(COLLEGE_ALIASES).sort((a, b) => b.length - a.length)) {
    if (take(new RegExp(` ${alias}( college)? `))) {
      college = COLLEGE_ALIASES[alias];
      break;
    }
  }

  const tags: Tag[] = [];
  const keywords: string[] = [];
  for (const w of s.trim().split(' ')) {
    if (!w || STOP.has(w)) continue;
    const tag = TAG_WORDS[w];
    if (tag) {
      if (!tags.includes(tag)) tags.push(tag);
    } else if (w !== 'free') keywords.push(w.replace(/'s$/, ''));
  }
  return { from, to, freeFood, college, tags, keywords, when };
}

export interface EventQuery {
  keywords?: string[];
  tags?: Tag[];
  from?: Date;
  to?: Date | null;
  college?: string | null;
  freeFood?: boolean;
}

export async function searchEvents(f: EventQuery, limit = 15): Promise<{ card: EventCard; score: number; hits: string[] }[]> {
  const cards = await listEvents({
    from: (f.from ?? new Date()).toISOString(),
    to: f.to ? f.to.toISOString() : undefined,
    college: f.college ?? undefined,
    freeFood: f.freeFood || undefined,
  });
  const words = (f.keywords ?? []).map((w) => w.toLowerCase()).filter(Boolean);
  const tags = f.tags ?? [];
  if (!words.length && !tags.length) return cards.filter((c) => c.status === 'live').slice(0, limit).map((card) => ({ card, score: 0, hits: [] }));

  return cards
    .filter((c) => c.status === 'live')
    .map((card) => {
      const hay = [card.title, card.placeName, card.hostName, card.food].join(' ').toLowerCase();
      const hits = words.filter((w) => hay.includes(w));
      const tagHits = tags.filter((t) => card.tags.includes(t));
      return { card, score: hits.length * 2 + tagHits.length, hits };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.card.start.localeCompare(b.card.start))
    .slice(0, limit);
}

const fmtWhen = (c: EventCard) => formatInTimeZone(new Date(c.start), TZ, c.allDay ? 'EEE, MMM d' : 'EEE, MMM d · h:mm a');

export async function keywordAsk(q: string, now = new Date()): Promise<AskResponse> {
  const p = parseQuery(q, now);
  let rows = await searchEvents(p, 8);
  // A query whose only words matched nothing still has its time, food, and college filters worth showing.
  if (!rows.length && p.keywords.length && (p.when || p.freeFood || p.college)) rows = await searchEvents({ ...p, keywords: [], tags: [] }, 8);
  const results = rows.map(({ card, hits }) => {
    const why = [card.freeFood ? 'Free food' : null, p.college && card.college === p.college ? card.college : null, hits.length ? `Mentions ${hits.slice(0, 2).join(', ')}` : null, fmtWhen(card)]
      .filter(Boolean)
      .join(' · ');
    return { event: card, why };
  });
  const n = results.length;
  const answer = n ? `${n} ${n === 1 ? 'event matches' : 'events match'}.` : 'Nothing matches that yet.';
  return { answer, results, mode: 'fallback' };
}

// Compact tool payloads keep Grok's context small.
function compact(c: EventCard) {
  return { id: c.id, title: c.title, start: c.start, place: c.placeName, host: c.hostName, tags: c.tags, freeFood: c.freeFood, food: c.food, college: c.college };
}

export async function toolSearchEvents(a: { keywords?: string; tags?: Tag[]; dateFrom?: string; dateTo?: string; college?: string; freeFood?: boolean }) {
  const valid = (s?: string) => (s && !Number.isNaN(Date.parse(s)) ? new Date(s) : undefined);
  const rows = await searchEvents({
    keywords: (a.keywords ?? '').toLowerCase().split(/\s+/).filter((w) => w && !STOP.has(w)),
    tags: a.tags,
    from: valid(a.dateFrom),
    to: valid(a.dateTo) ?? null,
    college: a.college || null,
    freeFood: a.freeFood,
  });
  return rows.map((r) => compact(r.card));
}

export async function toolSearchHosts(a: { keywords: string }) {
  const words = a.keywords.toLowerCase().split(/\s+/).filter((w) => w && !STOP.has(w));
  if (!words.length) return [];
  const hosts = await prisma.host.findMany({ where: { OR: words.map((w) => ({ name: { contains: w } })) }, take: 10 });
  const upcoming = hosts.length ? await listEvents({ from: new Date().toISOString() }) : [];
  return hosts.map((h) => ({
    id: h.id,
    name: h.name,
    upcoming: upcoming.filter((c) => c.hostName === h.name && c.status === 'live').slice(0, 5).map(compact),
  }));
}

export async function toolGetEvent(a: { id: string }) {
  const d = await getEvent(a.id);
  if (!d || d.status === 'review') return { error: 'not found' };
  return { ...compact(d), end: d.end, summary: d.summary, rsvpUrl: d.rsvpUrl, audience: d.audience, status: d.status };
}

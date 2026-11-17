// Keyword search for Ask Yapizza: the fallback when Grok is unavailable, and the backend of Grok's tools.
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { AskResponse, EventCard, Tag } from '@/lib/contracts';
import { cardInclude, getEvent, listEvents, prisma, toCard } from '@/lib/db';
import { TAG_LABELS } from '@/components/ui/TagChip';
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
  'a about all an and any anything are at be can do does event events find for from get going happening i im in info is it me my near of on open or session sessions show some something the there this to what whats where which who with yale you'.split(' '),
);

// Phrases students type, rewritten to the word event text uses.
const PHRASES: [string, string][] = [
  ['mental health', 'wellness'],
  ['asian american', 'aacc'],
  ['study break', 'break'],
  ['study abroad', 'abroad'],
  ['career fair', 'career'],
  ['career talks', 'career'],
  ['career talk', 'career'],
  ['computer science', 'cs'],
];

// Words students type vs words event text uses; a synonym hit scores at a discount.
const SYNONYMS: Record<string, string[]> = {
  asian: ['aacc'], aacc: ['asian'],
  black: ['af-am', 'afam', 'african american'],
  latinx: ['la casa', 'latino', 'latina'], latino: ['la casa', 'latinx'], hispanic: ['la casa', 'latino'],
  native: ['nacc', 'indigenous'], indigenous: ['nacc', 'native'],
  international: ['oiss', 'global', 'abroad'],
  mental: ['wellness', 'wellbeing', 'good life', 'glc'], wellness: ['mental', 'good life', 'glc'],
  volunteer: ['service', 'dwight hall', 'donation', 'drive'], service: ['volunteer', 'dwight hall'],
  math: ['yums', 'mathematic'],
  cs: ['computer science', 'ycs'],
  movie: ['film', 'screening'], film: ['screening', 'movie'],
  abroad: ['study abroad', 'international'],
};

/** Crude stem so "volunteering" finds "volunteer" and "panels" finds "panel"; matched at word starts. */
function stem(w: string): string {
  if (w.length > 6 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 5 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

const wordStart = (t: string) => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

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
  labels: Record<string, string>; // rewritten keyword -> the phrase the student typed
}

export function parseQuery(q: string, now = new Date()): ParsedQuery {
  let s = ` ${q.toLowerCase().replace(/'s\b/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `;
  const labels: Record<string, string> = {};
  for (const [phrase, to] of PHRASES) {
    if (!s.includes(` ${phrase} `)) continue;
    s = s.replace(` ${phrase} `, ` ${to} `);
    labels[to] = phrase;
  }
  const take = (re: RegExp) => {
    const hit = re.test(s);
    if (hit) s = s.replace(re, ' ');
    return hit;
  };

  // Default: from 90 minutes ago, so events that already ended today drop out but food still out shows.
  let from = new Date(now.getTime() - 90 * 6e4);
  let to: Date | null = null;
  let when: string | null = null;
  // Tonight keeps events that started in the last 90 minutes: free food is often still there.
  if (take(/ (tonight|this evening) /)) [from, to, when] = [new Date(now.getTime() - 90 * 6e4), nyMidnight(now, 1), 'Tonight'];
  else if (take(/ today /)) [from, to, when] = [from, nyMidnight(now, 1), 'Today'];
  else if (take(/ tomorrow( night)? /)) [from, to, when] = [nyMidnight(now, 1), nyMidnight(now, 2), 'Tomorrow'];
  else if (take(/ (this )?weekend /)) {
    const dow = Number(formatInTimeZone(now, TZ, 'i')); // 1 Mon .. 7 Sun
    const fri = dow >= 5 ? 0 : 5 - dow;
    const friEvening = nyMidnight(now, fri).getTime() + 17 * 36e5; // shortcut: ignores the DST-change Friday, fine for a 5 PM cutoff
    [from, to, when] = [new Date(Math.max(now.getTime(), friEvening)), nyMidnight(now, 8 - dow), 'This weekend'];
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
    } else if (w !== 'free') keywords.push(w);
  }
  return { from, to, freeFood, college, tags, keywords, when, labels };
}

export interface EventQuery {
  keywords?: string[];
  tags?: Tag[];
  from?: Date;
  to?: Date | null;
  college?: string | null;
  freeFood?: boolean;
}

export interface SearchRow {
  card: EventCard;
  score: number;
  hits: string[]; // query words that matched, as the student typed them
  tagHits: Tag[];
}

const FIELD_WEIGHTS = [3, 2, 2, 2, 1]; // title, host, place, food, summary

export async function searchEvents(f: EventQuery, limit = 15): Promise<SearchRow[]> {
  const rows = await prisma.event.findMany({
    where: {
      status: 'live',
      // All-day events sit at midnight; keep the ones on the first day of the window.
      OR: [{ start: { gte: f.from ?? new Date() } }, { allDay: true, start: { gte: nyMidnight(f.from ?? new Date(), 0) } }],
      ...(f.to ? { start: { lte: f.to } } : {}),
      // College events are tagged, or held at a place that names the college ("Silliman Buttery").
      ...(f.college
        ? { AND: [{ OR: [{ college: f.college }, { locationRaw: { contains: f.college } }, { placeId: { contains: f.college } }] }] }
        : {}),
      ...(f.freeFood ? { freeFood: true } : {}),
    },
    include: cardInclude,
    orderBy: { start: 'asc' },
  });
  const docs = rows.map((r) => {
    const card = toCard(r);
    return { card, fields: [card.title, card.hostName, card.placeName, card.food, r.summary].map((x) => (x ?? '').toLowerCase()) };
  });
  const words = [...new Set((f.keywords ?? []).map((w) => w.toLowerCase()).filter(Boolean))];
  const tags = f.tags ?? [];
  if (!words.length && !tags.length) return docs.slice(0, limit).map(({ card }) => ({ card, score: 0, hits: [], tagHits: [] }));

  // Each word scores by its best field, weighted by rarity, so "consulting" outweighs "info".
  const terms = words.map((w) => {
    const main = wordStart(stem(w));
    const syns = (SYNONYMS[stem(w)] ?? SYNONYMS[w] ?? []).map(wordStart);
    const matchIn = (d: (typeof docs)[number]) => {
      let best = 0;
      d.fields.forEach((text, i) => {
        if (main.test(text)) best = Math.max(best, FIELD_WEIGHTS[i]);
        else if (syns.some((re) => re.test(text))) best = Math.max(best, 0.6 * FIELD_WEIGHTS[i]);
      });
      return best;
    };
    const df = docs.filter((d) => matchIn(d) > 0).length;
    return { word: w, matchIn, idf: Math.log(1 + docs.length / (1 + df)) };
  });

  const scored = docs.map(({ card, fields }) => {
    let kw = 0;
    const hits: string[] = [];
    for (const t of terms) {
      const m = t.matchIn({ card, fields });
      if (m > 0) {
        kw += m * t.idf;
        hits.push(t.word);
      }
    }
    const tagHits = tags.filter((t) => card.tags.includes(t));
    return { card, kw, score: kw + tagHits.length, hits, tagHits };
  });

  // Prefer events that match the words; tag-only matches fill in when words found fewer than 3.
  const byWords = scored.filter((r) => r.kw > 0);
  let kept = byWords.length >= 3 || !tags.length ? byWords : [...byWords, ...scored.filter((r) => r.kw === 0 && r.tagHits.length)];
  kept.sort((a, b) => b.score - a.score || a.card.start.localeCompare(b.card.start));
  const top = kept[0]?.score ?? 0;
  kept = kept.filter((r) => r.score >= 0.35 * top); // drop the long tail of weak single-word hits
  // A weekly series shows once, at its next date.
  const seen = new Set<string>();
  kept = kept.filter((r) => {
    const key = r.card.title.toLowerCase();
    return !seen.has(key) && !!seen.add(key);
  });
  return kept.slice(0, limit).map(({ card, score, hits, tagHits }) => ({ card, score, hits, tagHits }));
}

export async function keywordAsk(q: string, now = new Date()): Promise<AskResponse> {
  const p = parseQuery(q, now);
  let rows = await searchEvents(p, 8);
  // Nothing matched everything: relax one filter at a time rather than answer empty.
  // A college is never dropped on its own: "something in JE" with nothing in JE says so plainly.
  let relaxed = 'none' as 'none' | 'close' | 'later' | 'elsewhere'; // widened: assigned inside relax()
  const relax = async (next: ParsedQuery, kind: 'close' | 'later' | 'elsewhere', limit = 8) => {
    if (rows.length) return;
    rows = await searchEvents(next, limit);
    if (rows.length) relaxed = kind;
  };
  const topical = p.keywords.length > 0 || p.tags.length > 0;
  if (topical && (p.when || p.freeFood || p.college)) await relax({ ...p, keywords: [], tags: [] }, 'close');
  if (p.when) await relax({ ...p, from: now, to: null }, 'later', 3);
  if (p.college && (p.freeFood || topical)) await relax({ ...p, college: null }, 'elsewhere');
  const later = relaxed === 'later';

  // The card already shows the time, so the why says only what matched.
  const results = rows.map(({ card, hits, tagHits }) => {
    const food = card.food ? `Free food: ${card.food.split(/\s+/).slice(0, 4).join(' ')}` : 'Free food';
    const matched = [...hits.map((h) => p.labels[h] ?? h).filter((h) => !(card.freeFood && card.food?.toLowerCase().includes(h))), ...tagHits.map((t) => TAG_LABELS[t].toLowerCase())];
    const why = [
      card.freeFood ? food : null,
      p.college && card.college === p.college ? card.college : null,
      matched.length ? `Matches ${matched.slice(0, 2).join(', ')}` : null,
      p.when && !later ? p.when : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return { event: card, why: why || 'Coming up' };
  });
  const n = results.length;
  const one = n === 1;
  const inCollege = p.college ? ` in ${p.college}` : '';
  const answer =
    relaxed === 'later'
      ? `Nothing${inCollege} ${p.when!.toLowerCase()}. ${one ? 'This is the next one.' : 'These are the next ones.'}`
      : relaxed === 'elsewhere'
        ? `Nothing${inCollege}. ${one ? 'This one is elsewhere.' : 'These are elsewhere.'}`
        : relaxed === 'close'
          ? `Nothing matches all of that. ${one ? 'This is close.' : 'These are close.'}`
          : n
            ? `${n} ${one ? 'event matches' : 'events match'}.`
            : p.college
              ? `Nothing${inCollege}${p.when ? ` ${p.when.toLowerCase()}` : ''} yet.`
              : 'Nothing matches that yet.';
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

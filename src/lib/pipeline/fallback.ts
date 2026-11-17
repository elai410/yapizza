import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { TAGS } from '@/lib/contracts';
import type { Audience, ExtractedEvent, ExtractionResult, Tag } from '@/lib/contracts';
import { findPlace, normalizeCollege } from '@/lib/yale';
import type { ExtractInput } from './types';

// Rule-based extractor for when Grok is unavailable (no key, replay miss, live failure).
// The caller sends every event it returns to review; these rules only aim to be roughly right.

const TZ = 'America/New_York';
const CONFIDENCE = 0.5;

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WD = '(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|rsday|urday)?';
const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';

// Explicit dates, with an optional weekday in front so the evidence quote reads naturally.
const EXPLICIT_DATE = new RegExp(
  `\\b(?:${WD},?\\s+)?(?:(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b|(\\d{1,2})/(\\d{1,2})(?:/\\d{2,4})?\\b)`,
  'gi',
);
// Bare weekday ("Monday", "this Friday") or relative day; plural weekdays and "every X" are recurring, not dates.
const RELATIVE_DATE = new RegExp(`(?<!every\\s)\\b(?:(?:this|next)\\s+)?(${WD})\\b(?!s)|\\b(today|tonight|tomorrow)\\b`, 'gi');
const TIME = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(noon)\b/gi;

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;
const NOT_AN_EVENT_PREFIX = /\b(deadlines?|due|closes?|closing|last day|before|until|through|ends|opens|reopens|survey)\b/i;
const FOOTER = /unsubscribe|you are receiving this/i;
const GREETING = /^(hi|hello|hey|dear|love|best|warmly|cheers|thanks|see you|be well|clear skies)\b|[,!]$/i;
const SALE = /\b(for sale|selling|gear sale|sale)\b/i;
const PRICE = /\$\d+(?:\.\d{2})?(?:\s*(?:each|a pair|per \w+))?/;

const FOOD = /\b(free food|pizza|food|dinner|lunch|breakfast|brunch|snacks|boba|refreshments|treats|dessert|catered|catering|tea|chicken and waffles|reception)\b/i;
const TAG_WORDS: Record<Tag, RegExp> = {
  free_food: FOOD,
  cultural: /\b(cultur\w*|heritage|showcase|night market|bollywood|dombra|south asian|central asian|aacc|la casa|nacc|af-am|mena\w*|diwali|lunar new year|fgli)\b/i,
  professional: /\b(recruiting|career|info(?:rmation)? session|internships?|fellowships?|networking|resume|interviews?|handshake|goldman|jane street|analyst|admissions advising)\b/i,
  academic: /\b(lecture|talk|seminar|panel|colloquium|workshop|research|fireside|q&a|study abroad|master class|prof\.?|professor|test-solv\w*|putnam|pset)\b/i,
  arts: /\b(concert|show|play|exhibit\w*|dramat|theat(?:er|re)|film|screening|music|dance|comedy|sketch|gallery|poetry|orchestra|yso|zines?|collages?|painting)\b/i,
  athletics: /\b(athletic\w*|sports?|yoga|climbing|boulder\w*|football|soccer|basketball|hockey|intramural|fitness|the game)\b/i,
  social: /\b(party|mixer|social|game night|movie night|watch party|study break|bonfire|halloween|costumes?|night market|stargazing)\b/i,
  traditions: /\b(college tea|harvard-yale|the game|feb club|handsome dan|traditions?|thanksgiving dinner)\b/i,
};

interface Block {
  text: string;        // verbatim slice of the email
  context: string;     // header lines above a bullet list (may carry the date)
  heading: string | null;
}

interface DateHit { y: number; m: number; d: number; quote: string; index: number; end: number; inBlock: boolean }
interface TimeHit { sh: number; sm: number; eh: number | null; em: number | null; quote: string; index: number; end: number }

export function fallbackExtract(input: ExtractInput, now?: Date): ExtractionResult {
  const anchor = parseAnchor(input.sentAt) ?? now ?? new Date();
  const body = stripFooter(input.text ?? '');
  const hostName = input.listName?.trim() || displayName(input.from) || null;
  const college = collegeOf(input.listName) ?? collegeOf(displayName(input.from)) ?? collegeOf(input.subject);

  const events: ExtractedEvent[] = [];
  for (const block of splitBlocks(body)) {
    const ev = blockToEvent(block, anchor, input, hostName, college);
    if (ev) events.push(ev);
  }

  if (events.length === 0) {
    const listing = saleListing(body, input, hostName, college);
    if (listing) events.push(listing);
  }
  return { events, flagged: false, flagReason: null };
}

// ---------- blocks ----------

function stripFooter(text: string): string {
  const t = text.replace(/\r\n/g, '\n');
  const lines = t.split('\n');
  const cut = lines.findIndex(function (l, i) {
    return FOOTER.test(l) || (l.trim() === '--' && i > 0);
  });
  return (cut === -1 ? lines : lines.slice(0, cut)).join('\n');
}

function isHeading(line: string): boolean {
  const l = line.trim();
  if (!l || l.length > 60 || GREETING.test(l) || /^(subject|from|to|date):/i.test(l) || /^-{3,}/.test(l)) return false;
  return !firstMatch(EXPLICIT_DATE, l) && !firstMatch(TIME, l);
}

function hasDateAndTime(line: string): boolean {
  return !!firstMatch(EXPLICIT_DATE, line) && !!firstMatch(TIME, line);
}

function splitBlocks(body: string): Block[] {
  const out: Block[] = [];
  let heading: string | null = null;
  for (const para of body.split(/\n\s*\n/)) {
    const lines = para.split('\n').filter(function (l) { return l.trim() !== ''; });
    if (lines.length === 0) continue;
    const bullets = lines.filter(function (l) { return BULLET.test(l); });
    // A lone "1) BULLDOG BLOCK PARTY" is a heading, not a list; a lone "- Wellness Wednesday. 2-3pm" is a list.
    if (bullets.length >= 2 || bullets.some(function (l) { return /^\s*[-*•]/.test(l); })) {
      // Header lines like "MON 11/9" give their date to the bullets below them.
      let context = '';
      for (const l of lines) {
        if (BULLET.test(l)) out.push({ text: l.trim(), context, heading });
        else context = l.trim();
      }
    } else if (lines.filter(hasDateAndTime).length >= 2) {
      // Several showtimes in one paragraph ("Thu Nov 12, 7:30pm" / "Fri Nov 13, 7:30pm"): one event per line.
      let local = heading;
      for (const l of lines) {
        if (hasDateAndTime(l)) out.push({ text: l.trim(), context: '', heading: local });
        else if (isHeading(l)) local = l.trim();
      }
    } else {
      out.push({ text: lines.join('\n'), context: '', heading });
    }
    for (const l of lines) if (isHeading(l) && !BULLET.test(l)) heading = l.trim();
  }
  return out;
}

// ---------- one event ----------

function blockToEvent(block: Block, anchor: Date, input: ExtractInput, hostName: string | null, college: string | null): ExtractedEvent | null {
  const hit = findDateTime(block, anchor);
  if (!hit) return null;
  const { date, time } = hit;
  const text = block.text;

  const title = makeTitle(block, date, time) ?? cleanSubject(input.subject) ?? 'Untitled event';
  const locationRaw = findLocation(text, date, time);
  const place = findPlace(locationRaw) ?? findPlace(text);

  const evidence: string[] = [];
  if (date.inBlock && time.index >= date.end && /^[\s,]*(?:at\s+)?$/.test(text.slice(date.end, time.index)) && !text.slice(date.end, time.index).includes('\n')) {
    evidence.push(text.slice(date.index, time.end));
  } else {
    evidence.push(date.quote, time.quote);
  }
  if (locationRaw) evidence.push(locationRaw);

  const tagText = `${title}\n${text}`;
  const tags = TAGS.filter(function (t) { return TAG_WORDS[t].test(tagText); });
  const foodMatch = text.match(FOOD);
  const freeFood = !!foodMatch && !/\$\d/.test(text);

  return {
    kind: 'event',
    title,
    start: toIso(date, time.sh, time.sm),
    end: time.eh === null ? null : toIso(date, time.eh, time.em ?? 0, time.sh * 60 + time.sm),
    allDay: false,
    locationRaw,
    placeId: place?.id ?? null,
    hostName,
    summary: squash(text).slice(0, 240),
    tags: freeFood ? tags : tags.filter(function (t) { return t !== 'free_food'; }),
    freeFood,
    food: freeFood && foodMatch ? foodMatch[0] : null,
    audience: audienceOf(`${text}\n${input.subject ?? ''}`),
    college,
    rsvpUrl: text.match(/https?:\/\/\S+/)?.[0] ?? null,
    price: null,
    evidence,
    confidence: CONFIDENCE,
  };
}

function findDateTime(block: Block, anchor: Date): { date: DateHit; time: TimeHit } | null {
  const text = block.text;
  const times = allMatches(TIME, text).map(parseTime).filter(function (t): t is TimeHit { return t !== null; });
  if (times.length === 0 || /\bdeadlines?\b/i.test(block.context)) return null;

  const explicit = allMatches(EXPLICIT_DATE, text)
    .map(function (m) { return explicitDate(m, anchor, true); })
    .filter(function (d): d is DateHit { return d !== null; });
  const hit = pairDateTime(text, explicit, times);
  if (hit) return hit;

  // Bullet under a dated header ("MON 11/9" then "- Wellness Wednesday. 2-3pm"): the header wins over weekday words.
  const ctx = firstMatch(EXPLICIT_DATE, block.context);
  const ctxDate = ctx ? explicitDate(ctx, anchor, false) : null;
  if (ctxDate && explicit.length === 0) return { date: ctxDate, time: times[0] };

  const relative = allMatches(RELATIVE_DATE, text)
    .map(function (m) { return relativeDate(m, anchor); })
    .filter(function (d): d is DateHit { return d !== null; });
  return pairDateTime(text, relative, times);
}

function pairDateTime(text: string, dates: DateHit[], times: TimeHit[]): { date: DateHit; time: TimeHit } | null {
  for (const d of dates) {
    // Skip "survey closes Tue 10/20", "GLC closes Thu 11/19 at 3pm and reopens Mon 11/30", "UPCOMING DEADLINES ... Nov 4 (1pm)".
    const sentenceStart = lastBoundary(text, d.index);
    if (NOT_AN_EVENT_PREFIX.test(text.slice(sentenceStart, d.index)) || /\bdeadlines?\b/i.test(text.slice(0, d.index))) continue;
    const nl = text.indexOf('\n', d.end);
    const nextNl = nl === -1 ? -1 : text.indexOf('\n', nl + 1);
    const windowEnd = nl === -1 || nextNl === -1 ? text.length : nextNl;
    const after = times.find(function (t) { return t.index >= d.end && t.end <= windowEnd; });
    // A time before the date counts only inside the same sentence ("7-9pm, tonight in DL 220").
    const before = times.find(function (t) { return t.index >= sentenceStart && t.end <= d.index; });
    const time = after ?? before;
    if (time) return { date: d, time };
  }
  return null;
}

function lastBoundary(text: string, index: number): number {
  let b = 0;
  const re = /[.!?]\s|\n/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null && m.index < index) b = m.index + m[0].length;
  return b;
}

function explicitDate(m: RegExpExecArray, anchor: Date, inBlock: boolean): DateHit | null {
  let month: number;
  let day: number;
  if (m[1]) {
    month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    day = Number(m[2]);
  } else {
    month = Number(m[3]);
    day = Number(m[4]);
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const [ay, am, ad] = nyYmd(anchor);
  // Pick the year that puts the date on or after the send date, allowing a month of slack for recaps.
  let y = ay;
  if (Date.UTC(y, month - 1, day) < Date.UTC(ay, am - 1, ad) - 30 * 86400000) y += 1;
  const check = new Date(Date.UTC(y, month - 1, day));
  if (check.getUTCDate() !== day) return null;
  return { y, m: month, d: day, quote: m[0], index: m.index, end: m.index + m[0].length, inBlock };
}

function relativeDate(m: RegExpExecArray, anchor: Date): DateHit | null {
  const [ay, am, ad] = nyYmd(anchor);
  const base = new Date(Date.UTC(ay, am - 1, ad));
  let offset = 0;
  if (m[2]) {
    offset = m[2].toLowerCase() === 'tomorrow' ? 1 : 0;
  } else {
    const names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const target = names.indexOf(m[1].slice(0, 3).toLowerCase());
    if (target === -1) return null;
    offset = (target - base.getUTCDay() + 7) % 7;
  }
  const d = new Date(base.getTime() + offset * 86400000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), quote: m[0], index: m.index, end: m.index + m[0].length, inBlock: true };
}

function parseTime(m: RegExpExecArray): TimeHit | null {
  const base = { quote: m[0], index: m.index, end: m.index + m[0].length };
  if (m[10]) return { sh: 12, sm: 0, eh: null, em: null, ...base };
  if (m[7]) {
    const h = to24(Number(m[7]), m[9]);
    return h === null ? null : { sh: h, sm: Number(m[8] ?? 0), eh: null, em: null, ...base };
  }
  const endH12 = Number(m[4]);
  const eh = to24(endH12, m[6]);
  let startMer = m[3];
  if (!startMer) {
    const s = Number(m[1]);
    // "11-1pm" starts in the morning; "12-6pm" starts at noon; "1:30-3:30pm" is all afternoon.
    startMer = s !== 12 && s > endH12 && m[6].toLowerCase() === 'pm' ? 'am' : m[6];
  }
  const sh = to24(Number(m[1]), startMer);
  if (sh === null || eh === null) return null;
  return { sh, sm: Number(m[2] ?? 0), eh, em: Number(m[5] ?? 0), ...base };
}

function to24(h: number, mer: string): number | null {
  if (h < 1 || h > 12) return null;
  return (h % 12) + (mer.toLowerCase() === 'pm' ? 12 : 0);
}

function toIso(date: DateHit, h: number, min: number, startMinutes?: number): string {
  let day = new Date(Date.UTC(date.y, date.m - 1, date.d));
  // An end before the start ("11pm-1am") rolls to the next day.
  if (startMinutes !== undefined && h * 60 + min <= startMinutes) day = new Date(day.getTime() + 86400000);
  const local = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}T${pad(h)}:${pad(min)}:00`;
  return formatInTimeZone(fromZonedTime(local, TZ), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

// ---------- title, place, audience ----------

const LEAD = /^(?:(?:quick )?update:|reminder:|heads up:|unfortunately,|save the date:|new:|also|please join us for|join us for|celebrate with us at|come (?:out )?(?:to|for)|we(?:'re| are) hosting|we have|there(?:'s| is| will be)|our)\s+(?:an?\s+|the\s+)?/i;
const TRAIL = /(?:[\s,:;\-–(]+|\s+(?:on|at|is|are|is back|this|from|in|tonight|today|tomorrow|next))$/i;

function makeTitle(block: Block, date: DateHit, time: TimeHit): string | null {
  const text = block.text;
  const firstNl = text.indexOf('\n');
  const firstLineEnd = firstNl === -1 ? text.length : firstNl;
  let cut = firstLineEnd;
  if (date.inBlock && date.index < cut) cut = date.index;
  if (time.index < cut) cut = time.index;
  let t = text.slice(0, cut).replace(BULLET, '');
  const sentence = t.search(/(?<!\b(?:Prof|Dr|Mr|Ms|Mrs|St|vs|Rm|Ave|No|[A-Z]))[.!?](?:\s|$)/);
  if (sentence !== -1) t = t.slice(0, sentence);
  t = tidyTitle(t);
  if (t.length < 3) return block.heading ? tidyTitle(block.heading) || null : null;
  return t;
}

function tidyTitle(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = t.replace(LEAD, '').replace(TRAIL, '').trim();
    if (t === before) break;
  }
  // "If you signed up..., we have a mandatory planning meeting" -> the clause that names the event.
  const segs = t.split(/,\s+/);
  for (let i = 1; i < segs.length; i++) {
    if (LEAD.test(segs[i])) {
      t = segs.slice(i).join(', ').replace(LEAD, '').replace(TRAIL, '').trim();
      break;
    }
  }
  if (/[A-Z]/.test(t) && t === t.toUpperCase()) t = titleCase(t);
  if (t.length > 80) t = t.slice(0, 80).replace(/\s+\S*$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function titleCase(s: string): string {
  const small = new Set(['a', 'an', 'and', 'at', 'for', 'from', 'in', 'of', 'on', 'the', 'to', 'with']);
  return s.toLowerCase().split(' ').map(function (w, i) {
    if (i > 0 && small.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function findLocation(text: string, date: DateHit, time: TimeHit): string | null {
  const lineEnd = function (i: number): number {
    const n = text.indexOf('\n', i);
    return n === -1 ? text.length : n;
  };
  const tryAfter = function (from: number): string | null {
    const seg = text.slice(from, lineEnd(from)).replace(/^\s*(?:ET|EST|EDT)\b/, '');
    const m = seg.match(/^\s*(?:,\s*(?:(?:in|at|on)\s+)?|\s+(?:in|at|on)\s+)(?:the\s+)?([^.;()\n]+)/i);
    return m ? cleanPlace(m[1]) : null;
  };
  const between = function (): string | null {
    if (!date.inBlock || time.index <= date.end) return null;
    const seg = text.slice(date.end, time.index);
    const m = seg.match(/\s(?:in|at)\s+(?:the\s+)?([A-Z][^.;,(\n]*)/);
    return m ? cleanPlace(m[1]) : null;
  };
  const nextLine = function (): string | null {
    const end = lineEnd(time.end);
    // Only when the time ends its line ("7-9pm" then "Woolsey Hall"), ignoring "(doors 6:30)" or "EST".
    const rest = text.slice(time.end, end).replace(/\([^)]*\)/g, '').replace(/\b(?:ET|EST|EDT)\b/, '').trim();
    if (end >= text.length || rest !== '') return null;
    const line = text.slice(end + 1, lineEnd(end + 1)).trim();
    if (!line || line.length > 60 || /[.!?]$/.test(line) || firstMatch(TIME, line) || firstMatch(EXPLICIT_DATE, line)) return null;
    return line;
  };
  // Room-change notes name the new room: "has moved from WLH 120 to LC 102".
  const moved = text.match(/\bmoved\s+(?:from\s+.+?\s+)?to\s+(?:the\s+)?([A-Z][^.;,()\n]*)/);
  if (moved) return cleanPlace(moved[1]);
  return tryAfter(time.end) ?? (date.inBlock && date.end > time.end ? tryAfter(date.end) : null) ?? between() ?? nextLine();
}

function cleanPlace(raw: string): string | null {
  const p = raw.trim().replace(/\s+as usual$/i, '').replace(/[\s,]+$/, '');
  if (!p || p.length > 70 || !/^[A-Z0-9]/.test(p) || firstMatch(TIME, p) || /^(free|no|yes|register|bring|costumes?)\b/i.test(p)) return null;
  return p;
}

function audienceOf(text: string): Audience {
  if (/\bmembers[- ]only\b|\bfor members\b|\bonly for members\b/i.test(text)) return 'members_only';
  if (/\b\w+\s+(?:students|residents)\s+only\b|\bonly open to \w+ (?:students|residents)\b/i.test(text)) return 'college_only';
  return 'open_to_all';
}

// ---------- listings ----------

function saleListing(body: string, input: ExtractInput, hostName: string | null, college: string | null): ExtractedEvent | null {
  const all = `${input.subject ?? ''}\n${body}`;
  const price = body.match(PRICE);
  if (!SALE.test(all) || !price) return null;
  return {
    kind: 'listing',
    title: cleanSubject(input.subject) ?? 'For sale',
    start: null,
    end: null,
    allDay: false,
    locationRaw: null,
    placeId: findPlace(body)?.id ?? null,
    hostName,
    summary: squash(body).slice(0, 240),
    tags: [],
    freeFood: false,
    food: null,
    audience: audienceOf(all),
    college,
    rsvpUrl: null,
    price: price[0],
    evidence: [price[0]],
    confidence: CONFIDENCE,
  };
}

// ---------- small helpers ----------

function cleanSubject(subject: string | null | undefined): string | null {
  if (!subject) return null;
  const s = subject.replace(/^(?:(?:re|fwd?):\s*|\[[^\]]*\]\s*)+/i, '').trim();
  return s ? tidyTitle(s) : null;
}

function displayName(from: string | null | undefined): string | null {
  if (!from) return null;
  const m = from.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : null;
}

function collegeOf(s: string | null | undefined): string | null {
  if (!s) return null;
  const words = s.trim().split(/\s+/);
  return normalizeCollege(words.slice(0, 2).join(' ')) ?? normalizeCollege(words[0]);
}

function parseAnchor(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function nyYmd(d: Date): [number, number, number] {
  const [y, m, day] = formatInTimeZone(d, TZ, 'yyyy-MM-dd').split('-').map(Number);
  return [y, m, day];
}

function allMatches(re: RegExp, s: string): RegExpExecArray[] {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  const out: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = g.exec(s)) !== null) {
    out.push(m);
    if (m[0] === '') g.lastIndex++;
  }
  return out;
}

function firstMatch(re: RegExp, s: string): RegExpExecArray | null {
  return allMatches(re, s)[0] ?? null;
}

function squash(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

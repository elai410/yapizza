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
// "Nov 2-6" is a day range (group 3); "Nov 2 5-6pm" and "Nov 4 - 7pm" are a date and a time.
const EXPLICIT_DATE = new RegExp(
  `\\b(?:${WD},?\\s+)?(?:(${MONTH})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*[-–]\\s*(\\d{1,2})\\b(?!:|\\s*(?:am|pm)\\b))?|(\\d{1,2})/(\\d{1,2})(?:/\\d{2,4})?\\b)`,
  'gi',
);
// Calendar exports: "2026-10-17T11:00:00-04:00 - 13:30".
const ISO = /\b(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?(Z|[+-]\d{2}:?\d{2})?(?:\s*[-–]\s*(?:\d{4}-\d{2}-\d{2}T)?(\d{2}):(\d{2})(?::\d{2})?(?:Z|[+-]\d{2}:?\d{2})?)?/g;
// "weekly Sundays", "Mondays 3-4pm", "every Friday": a recurring day, resolved to its next date.
const RECURRING = new RegExp(`\\b(?:(${WD})s|every\\s+(${WD}))\\b`, 'gi');
// Online events name their venue in lowercase ("(virtual)", ", Zoom"), which place rules skip.
const ONLINE = /\b(?:zoom|virtual|ms teams)\b/i;
// Bare weekday ("Monday", "this Friday") or relative day; plural weekdays and "every X" are recurring, not dates.
const RELATIVE_DATE = new RegExp(`(?<!every\\s)\\b(?:(?:this|next)\\s+)?(${WD})\\b(?!s)|\\b(today|tonight|tomorrow)\\b`, 'gi');
const TIME = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\b(noon)\b|\b(midnight)\b/gi;
// "Pre-show by Flannel at 11:30pm, main show at midnight": a time for the warm-up is not the start.
const PRESHOW = /\b(?:pre-?show|doors(?:\s+open)?|check-in)\b[^.,;()]*$/i;

const BULLET = /^\s*(?:[-*•]|\d+[.)])\s+/;
const NOT_AN_EVENT_PREFIX = /\b(deadlines?|due|closes?|closing|last day|before|until|through|ends|opens|reopens|survey)\b/i;
const FOOTER = /unsubscribe|you are receiving this/i;
const GREETING = /^(hi|hello|hey|dear|love|best|warmly|cheers|thanks|see you|be well|clear skies)\b|[,!]$/i;
const SALE = /\b(for sale|selling|gear sale|sale)\b/i;
const PRICE = /\$\d+(?:\.\d{2})?(?:\s*(?:each|a pair|per \w+))?/;

// Food only where the text names food (CLAUDE.md 13.1): "tea" and "reception" alone don't count.
const FOOD = /\b(free food|pizza|food|dinner|lunch|breakfast|brunch|snacks|boba|refreshments|treats?|dessert|catered|catering|chicken and waffles|dim sum)\b/i;
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
  nth?: number;        // which time on the line ("1:30pm and 7:30pm" is two shows)
  placeHint?: string;  // place stated once for a run of showtimes
}

interface DateHit { y: number; m: number; d: number; quote: string; index: number; end: number; inBlock: boolean; rangeEnd?: number }
interface TimeHit { sh: number; sm: number; eh: number | null; em: number | null; quote: string; index: number; end: number }
// time null: an all-day event. segEnd: where this date's part of a multi-date line ends.
interface Hit { date: DateHit; time: TimeHit | null; segEnd?: number }

// Lead decision 17:25: with no Grok key, rule events whose evidence checks out go live so sim demos show cards.
// Set false to restore CLAUDE.md 9 (every fallback event to review).
export const FALLBACK_LIVE_WHEN_EVIDENCE_OK = true;

export function fallbackExtract(input: ExtractInput, now?: Date): ExtractionResult {
  const anchor = parseAnchor(input.sentAt) ?? now ?? new Date();
  const body = stripFooter(input.text ?? '');
  const presenter = input.listName?.trim() ? null : presentsHost(body);
  const hostName = listHost(input.listName) || presenter || displayName(input.from) || null;
  const college = collegeOf(input.listName) ?? collegeOf(displayName(input.from)) ?? collegeOf(input.subject);

  const events: ExtractedEvent[] = [];
  for (const block of splitBlocks(body).flatMap(splitSemicolons)) {
    events.push(...blockToEvents(block, anchor, input, hostName, college));
  }

  // A flyer that says only its title reads better with who is putting it on.
  if (presenter) {
    for (const ev of events) if (ev.summary === ev.title) ev.summary = `${presenter} presents ${ev.title}.`;
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
  const paras = body.split(/\n\s*\n/);
  for (let pi = 0; pi < paras.length; pi++) {
    const para = paras[pi];
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
      let last = 0;
      const shows: Block[] = [];
      lines.forEach(function (l, i) {
        if (hasDateAndTime(l)) {
          last = i;
          const n = allMatches(TIME, l).length;
          for (let k = 0; k < n; k++) shows.push({ text: l.trim(), context: '', heading: local, nth: k });
        } else if (isHeading(l)) local = l.trim();
      });
      // The venue is often stated once, on the line after the showtimes ("University Theatre").
      const next = [...lines.slice(last + 1), ...(paras[pi + 1] ?? '').split('\n')].map(function (l) { return l.trim(); }).find(Boolean);
      const placeHint = next && next.length <= 60 && findPlace(next) && !firstMatch(TIME, next) && !firstMatch(EXPLICIT_DATE, next) ? next : undefined;
      for (const b of shows) out.push({ ...b, placeHint });
    } else {
      out.push({ text: lines.join('\n'), context: '', heading });
    }
    for (const l of lines) if (isHeading(l) && !BULLET.test(l)) heading = l.trim();
  }
  return out;
}

// "Intermediate HPC - Mon Nov 9, 1-4pm, ...; Biomedical Imaging - Wed Nov 11, 10am-12pm, ...": one block per dated part.
// Semicolons inside parentheses don't split; undated parts stay with the part before them.
function splitSemicolons(b: Block): Block[] {
  if (b.nth !== undefined) return [b];
  const text = b.text;
  const parts: [number, number][] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if (i === text.length || (c === ';' && depth === 0)) {
      const seg = text.slice(start, i);
      if (parts.length && !firstMatch(EXPLICIT_DATE, seg)) parts[parts.length - 1][1] = i;
      else parts.push([start, i]);
      start = i + 1;
    }
  }
  if (parts.length < 2 || !firstMatch(EXPLICIT_DATE, text.slice(parts[0][0], parts[0][1]))) return [b];
  // A part with no name of its own ("Fri Nov 6, 2:00-3:00pm Poorvu 120A") takes the first part's.
  const first = text.slice(parts[0][0], parts[0][1]);
  const cut = Math.min(firstMatch(EXPLICIT_DATE, first)?.index ?? first.length, firstMatch(TIME, first)?.index ?? first.length);
  const name = first.slice(0, cut).trim();
  return parts.map(function ([s, e]) {
    return { text: text.slice(s, e).trim(), context: b.context, heading: name.length >= 3 ? name : b.heading };
  });
}

// ---------- one event ----------

function blockToEvents(block: Block, anchor: Date, input: ExtractInput, hostName: string | null, college: string | null): ExtractedEvent[] {
  const hits = findDateTimes(block, anchor);
  if (hits.length === 0) return [];
  // Every event on a multi-date line shares the name before the first date.
  // The name ends at the first time on the line, even one a later date borrows ("Sundays: 2:30-3:30pm ..., 4-5pm ...: Nov 1").
  const t0 = hits[0].time ?? dateAsTime(hits[0].date);
  const earliest = firstMatch(TIME, block.text);
  const cutAt = earliest && earliest.index < t0.index ? { ...t0, index: earliest.index } : t0;
  const title = makeTitle(block, hits[0].date, cutAt, input.subject) ?? cleanSubject(input.subject) ?? 'Untitled event';
  return hits.map(function (h) { return hitToEvent(block, h, title, input, hostName, college); });
}

function dateAsTime(d: DateHit): TimeHit {
  return { sh: 0, sm: 0, eh: null, em: null, quote: d.quote, index: d.index, end: d.end };
}

function hitToEvent(block: Block, hit: Hit, title: string, input: ExtractInput, hostName: string | null, college: string | null): ExtractedEvent {
  const { date } = hit;
  const time = hit.time ?? dateAsTime(date);
  const text = block.text;

  const locationRaw = (hit.segEnd !== undefined ? segmentPlace(text, Math.max(date.end, hit.time && hit.time.index >= date.end ? hit.time.end : 0), hit.segEnd) : null)
    ?? findLocation(text, date, time) ?? block.placeHint ?? onlinePlace(text);
  const place = findPlace(locationRaw) ?? findPlace(text);

  const evidence: string[] = [];
  if (!hit.time || time.index === date.index) {
    evidence.push(date.quote);
  } else if (date.inBlock && time.index >= date.end && /^[\s,]*(?:at\s+)?$/.test(text.slice(date.end, time.index)) && !text.slice(date.end, time.index).includes('\n')) {
    evidence.push(text.slice(date.index, time.end));
  } else {
    evidence.push(date.quote, time.quote);
  }
  if (locationRaw) evidence.push(locationRaw);

  const tagText = `${title}\n${text}`;
  const tags = TAGS.filter(function (t) { return TAG_WORDS[t].test(tagText); });
  // The title counts too: "Pizza Seminar: The Weil Conjectures" may come from the subject line.
  const foodMatch = text.match(FOOD) ?? title.match(FOOD);
  const freeFood = !!foodMatch && !/\$\d/.test(text);

  return {
    kind: 'event',
    title,
    start: toIso(date, time.sh, time.sm),
    end: !hit.time
      ? (date.rangeEnd ? toIso({ ...date, d: date.rangeEnd }, 23, 59) : null)
      : time.eh === null ? null : toIso(date, time.eh, time.em ?? 0, time.sh * 60 + time.sm),
    allDay: !hit.time,
    locationRaw,
    placeId: place?.id ?? null,
    hostName,
    summary: makeSummary(block, evidence.filter(function (q) { return q !== locationRaw; }), locationRaw, title),
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

function findDateTimes(block: Block, anchor: Date): Hit[] {
  const text = block.text;
  const iso = allMatches(ISO, text).map(isoHit).filter(function (h): h is Hit { return h !== null; });
  if (iso.length) return iso;
  if (/\bdeadlines?\b/i.test(block.context)) return [];
  const times = mainTimes(text, block.nth);
  const explicit = explicitDates(text, anchor);
  if (block.nth === undefined) {
    const multi = multiDateTimes(text, explicit, times, anchor);
    if (multi.length >= 2) return multi;
  }
  const one = findDateTime(block, anchor, times, explicit);
  // "weekly Mondays 7-9pm (Oct 19 held in WLH 001)" read after Oct 19: the dated exception is over, not the event.
  if (one && firstMatch(RECURRING, text) && dateMs(one.date) < dateMs(dayOf(anchor))) return [];
  // "Nov 2-6, 4:00-6:00pm": a run of days is one all-day event, whatever the daily hours.
  if (one) return [one.date.rangeEnd ? { date: one.date, time: null } : one];
  // A listing line "Name - Date" with no time ("Explore Summer Internships - Tue Oct 27", "Restaurant Week - Nov 1-14")
  // is all day. A date in prose ("Roshni 2026, Fri Nov 6.") stays skipped, as before.
  if (times.length === 0 && block.nth === undefined) {
    const dated = explicit.filter(function (d) { return !nonEventDate(text, d); });
    const d = dated[0];
    if (dated.length === 1 && /\S\s+[-–|]\s+$/.test(text.slice(lastBoundary(text, d.index), d.index)) && /^\s*(?:$|[,;(\n])/.test(text.slice(d.end))) {
      return [{ date: d, time: null }];
    }
  }
  return [];
}

function mainTimes(text: string, nth?: number): TimeHit[] {
  let times = allMatches(TIME, text).map(parseTime).filter(function (t): t is TimeHit { return t !== null; });
  if (nth) times = times.slice(nth);
  const main = times.filter(function (t) { return !PRESHOW.test(text.slice(Math.max(0, t.index - 60), t.index)); });
  return main.length > 0 ? main : times;
}

function explicitDates(text: string, anchor: Date): DateHit[] {
  return allMatches(EXPLICIT_DATE, text)
    .map(function (m) { return explicitDate(m, anchor, true); })
    .filter(function (d): d is DateHit { return d !== null; });
}

// Several dates on one line, each with its own time ("Sat Oct 17, 1-2pm, WLH 211 and Sun Oct 18, 4-5pm, WLH 207"),
// or one stated time for a list of dates ("Mondays 3-4pm, YSC Offline Oasis: Oct 19 (...), Oct 26 (...)").
function multiDateTimes(text: string, explicit: DateHit[], times: TimeHit[], anchor: Date): Hit[] {
  const dates = explicit.filter(function (d) { return !nonEventDate(text, d); });
  if (dates.length === 0 || times.length === 0) return [];
  const recurring = firstMatch(RECURRING, text.slice(0, dates[0].index));
  const weekday = recurring ? weekdayIndex(recurring[1] ?? recurring[2]) : -1;
  const shared = times.filter(function (t) { return t.end <= dates[0].index; }).pop() ?? null;
  const out: Hit[] = [];
  dates.forEach(function (d, i) {
    const segEnd = i + 1 < dates.length ? dates[i + 1].index : text.length;
    if (d.rangeEnd) { out.push({ date: d, time: null, segEnd }); return; }
    const own = times.filter(function (t) { return t.index >= d.end && t.end <= segEnd; });
    if (own.length) {
      out.push({ date: d, time: own[0], segEnd });
      // "7:30pm and 9:30pm", "1:30pm (pay what you can) and 7:30pm": two shows; "(pizza at 6pm)" is not.
      for (let k = 1; k < own.length; k++) {
        if (!/^\s*,?\s*(?:and|&)\s*$/.test(text.slice(own[k - 1].end, own[k].index).replace(/\([^)]*\)/g, ''))) break;
        out.push({ date: d, time: own[k], segEnd });
      }
      return;
    }
    // "Thu Nov 12 and Fri Nov 13 at 7:30pm": a date joined to the next one shares its time.
    const next = dates[i + 1];
    if (next && /^\s*(?:,|and|&|,\s*and)\s*$/.test(text.slice(d.end, next.index))) {
      const nextEnd = i + 2 < dates.length ? dates[i + 2].index : text.length;
      const t = times.find(function (x) { return x.index >= next.end && x.end <= nextEnd; });
      if (t) { out.push({ date: d, time: t, segEnd }); return; }
    }
    // A listed date takes the stated time if it falls on the stated weekday ("Putnam exam Sat Dec 5" under "Wednesdays" doesn't).
    if (shared && (weekday === -1 || weekdayOf(d) === weekday)) out.push({ date: d, time: shared, segEnd });
  });
  return out.filter(function (h) { return h.time === null || dateMs(h.date) >= dateMs(dayOf(anchor)) - 30 * 86400000; });
}

function isoHit(m: RegExpExecArray): Hit | null {
  const [, y, mo, d, h, mi, off, eh, emi] = m;
  const wall = function (hh: string, mm: string): [number, number, number, number, number] {
    if (!off) return [Number(y), Number(mo), Number(d), Number(hh), Number(mm)];
    const ms = Date.parse(`${y}-${mo}-${d}T${hh}:${mm}:00${off === 'Z' ? 'Z' : off.replace(/^([+-]\d{2})(\d{2})$/, '$1:$2')}`);
    if (Number.isNaN(ms)) return [NaN, 0, 0, 0, 0];
    return formatInTimeZone(new Date(ms), TZ, 'yyyy-M-d-H-m').split('-').map(Number) as [number, number, number, number, number];
  };
  const [sy, sm, sd, sh, smin] = wall(h, mi);
  if (Number.isNaN(sy) || sh > 23 || smin > 59) return null;
  const base = { quote: m[0], index: m.index, end: m.index + m[0].length };
  const end = eh ? wall(eh, emi) : null;
  return {
    date: { y: sy, m: sm, d: sd, inBlock: true, ...base },
    time: { sh, sm: smin, eh: end ? end[3] : null, em: end ? end[4] : null, ...base },
  };
}

function weekdayIndex(name: string): number {
  return ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(name.slice(0, 3).toLowerCase());
}

function weekdayOf(d: DateHit): number {
  return new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay();
}

function dateMs(d: { y: number; m: number; d: number }): number {
  return Date.UTC(d.y, d.m - 1, d.d);
}

function dayOf(anchor: Date): { y: number; m: number; d: number } {
  const [y, m, d] = nyYmd(anchor);
  return { y, m, d };
}

function findDateTime(block: Block, anchor: Date, times: TimeHit[], explicit: DateHit[]): { date: DateHit; time: TimeHit } | null {
  const text = block.text;
  if (times.length === 0) return null;
  const hit = pairDateTime(text, explicit, times);
  if (hit) return hit;

  // Bullet under a dated header ("MON 11/9" then "- Wellness Wednesday. 2-3pm"): the header wins over weekday words.
  const ctx = firstMatch(EXPLICIT_DATE, block.context);
  const ctxDate = ctx ? explicitDate(ctx, anchor, false) : null;
  if (ctxDate && explicit.length === 0) return { date: ctxDate, time: times[0] };

  const relative = allMatches(RELATIVE_DATE, text)
    .map(function (m) { return relativeDate(m, anchor); })
    .filter(function (d): d is DateHit { return d !== null; });
  const rel = pairDateTime(text, relative, times);
  if (rel) return rel;
  // "Mondays 3-4pm, YSC Offline Oasis. This week (10/19): ..." : the one date in the block takes the block's time,
  // unless it is already past and the block repeats weekly ("weekly Mondays 7-9pm (Oct 19 held in WLH 001)").
  const recurring = firstMatch(RECURRING, text);
  const dated = explicit.filter(function (d) { return !nonEventDate(text, d); });
  // A weekly item with no date of its own ("Game Night, Wednesdays 6-7pm") is still skipped.
  return dated.length === 1 && explicit.length === 1 && !(recurring && dateMs(dated[0]) < dateMs(dayOf(anchor))) ? { date: dated[0], time: times[0] } : null;
}

function pairDateTime(text: string, dates: DateHit[], times: TimeHit[]): { date: DateHit; time: TimeHit } | null {
  for (const d of dates) {
    // Skip "survey closes Tue 10/20", "GLC closes Thu 11/19 at 3pm and reopens Mon 11/30", "UPCOMING DEADLINES ... Nov 4 (1pm)".
    const sentenceStart = lastBoundary(text, d.index);
    if (nonEventDate(text, d)) continue;
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

function nonEventDate(text: string, d: DateHit): boolean {
  // Only the words just before the date: "survey closes Tue 10/20", not "One Last Sweet Treat Before Thanksgiving Break - Wed Nov 18".
  const from = lastBoundary(text, d.index);
  const near = d.index - from > 30 ? text.slice(d.index - 30, d.index).replace(/^\S*\s/, '') : text.slice(from, d.index);
  return NOT_AN_EVENT_PREFIX.test(near) || /\bdeadlines?\b/i.test(text.slice(0, d.index));
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
    month = Number(m[4]);
    day = Number(m[5]);
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const [ay, am, ad] = nyYmd(anchor);
  // Pick the year that puts the date on or after the send date, allowing a month of slack for recaps.
  let y = ay;
  if (Date.UTC(y, month - 1, day) < Date.UTC(ay, am - 1, ad) - 30 * 86400000) y += 1;
  const check = new Date(Date.UTC(y, month - 1, day));
  if (check.getUTCDate() !== day) return null;
  const rangeEnd = m[3] && Number(m[3]) > day && Number(m[3]) <= 31 ? Number(m[3]) : undefined;
  return { y, m: month, d: day, quote: m[0], index: m.index, end: m.index + m[0].length, inBlock, rangeEnd };
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
  if (m[11]) return { sh: 24, sm: 0, eh: null, em: null, ...base }; // midnight ends the named day
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

function toIso(date: DateHit, hour: number, min: number, startMinutes?: number): string {
  let day = new Date(Date.UTC(date.y, date.m - 1, date.d));
  let h = hour;
  if (h >= 24) {
    h -= 24;
    day = new Date(day.getTime() + 86400000);
  }
  // An end before the start ("11pm-1am") rolls to the next day.
  if (startMinutes !== undefined && h * 60 + min <= startMinutes) day = new Date(day.getTime() + 86400000);
  const local = `${day.getUTCFullYear()}-${pad(day.getUTCMonth() + 1)}-${pad(day.getUTCDate())}T${pad(h)}:${pad(min)}:00`;
  return formatInTimeZone(fromZonedTime(local, TZ), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

// ---------- title, place, audience ----------

const LEAD = /^(?:(?:quick )?update:|reminder:|heads up:|unfortunately,|save the date:|new:|also|please join us for|join us for|celebrate with us at|come (?:out )?(?:to|for)|we(?:'re| are) hosting|we have|there(?:'s| is| will be)|our)\s+(?:an?\s+|the\s+)?/i;
const TRAIL = /(?:[\s,:;|\-–(]+|\s+(?:on|at|is|are|is back|this|from|in|tonight|today|tomorrow|next))$/i;
// "YCC Senate Meetings - weekly Sundays", "Gentle Yoga Mon": the schedule is not the name ("Wellness Wednesday" is).
const RECUR_TRAIL = new RegExp(`(?:\\s+[-–|]\\s*(?:(?:weekly|every)\\s+)?|\\s+(?:weekly|every)\\s+)${WD}s?$`, 'i');
const WD_ABBR_TRAIL = /\s+(?:Mon|Tues?|Wed|Thu(?:rs?)?|Fri|Sat|Sun)\.?$/;

// "After October break: Painting Plant Pots" and "Gear sale before break": the timing is not the name.
const TIME_LEAD = /^(?:after|before|during|over|this|next|later this|coming up)\b[^:]{0,30}:\s+/i;
const TIME_TRAIL = /\s+(?:before|after|over|during|this|next)\s+(?:the\s+)?(?:(?:fall|october|winter|spring|thanksgiving|november)\s+)?(?:break|recess|weekend|week|finals)$/i;
// "AT DWIGHT HALL THIS WEEKEND" over a paragraph is a section heading, not the event.
const SECTION = /^(?:at|around|this|next|upcoming|coming up|also|in|on)\b|\bthis (?:week|weekend)\b/i;
// "putnam problem sessions are wednesdays" -> "putnam problem sessions".
const VERB = /\s+(?:is|are|will be|takes over|takes|returns|kicks off)\s+\S.*$/i;
const GENERIC = /^(?:(?:mandatory|general|weekly|monthly|planning|board|body|info(?:rmation)?|first|next|last|short|quick|team|club|members?)\s+)*(meeting|session|gbm)s?$/i;
const SPEAKER = /^(?:prof\.?|professor|dr\.?)\s/i;
// Uppercase words that stay uppercase when a shouted title is title-cased.
const ACRONYMS = new Map(['AASA', 'AACC', 'YCC', 'YUMS', 'WLH', 'LC', 'OCAY', 'FGLI', 'GA', 'HoC', 'REU', 'REUs', 'MMATHS', 'YASSS', 'SPS', 'WIP', 'YSO', 'YC3', 'YCT', 'DL', 'AKW', 'NACC', 'CEID', 'TEAL', 'PWG', 'JE', 'TD', 'STEM', 'YSS', 'AGPC', 'LGBTQ', 'PAE', 'WaMH', 'Q&A', 'GBM'].map(function (a) { return [a.toUpperCase(), a]; }));

function makeTitle(block: Block, date: DateHit, time: TimeHit, subject?: string | null): string | null {
  const text = block.text;
  let start = 0;
  const firstNl = text.indexOf('\n');
  const firstLine = text.slice(0, firstNl === -1 ? text.length : firstNl).trim();
  if (firstNl !== -1 && firstLine === firstLine.toUpperCase() && SECTION.test(firstLine)) start = firstNl + 1;
  const nl = text.indexOf('\n', start);
  let cut = nl === -1 ? text.length : nl;
  if (date.inBlock && date.index >= start && date.index < cut) cut = date.index;
  if (time.index >= start && time.index < cut) cut = time.index;
  let t = text.slice(start, cut).replace(BULLET, '');
  const sentence = t.search(/(?<!\b(?:Prof|Dr|Mr|Ms|Mrs|St|vs|Rm|Ave|No|[A-Z]))[.!?](?:\s|$)/);
  if (sentence !== -1) t = t.slice(0, sentence);
  t = tidyTitle(t);

  // "Prof. Alexander Petrov" over "\"The Weil Conjectures\"": the talk is the title, not the speaker.
  const quoted = text.slice(start).match(/["“]([^"”\n]{3,80})["”]/);
  if (SPEAKER.test(t) && quoted) {
    const subj = (cleanSubject(subject) ?? '').replace(new RegExp(`\\s+(?:(?:this|next)\\s+)?${WD}\\b`, 'gi'), '');
    t = subj.toLowerCase().includes(quoted[1].toLowerCase()) ? tidyTitle(subj) : tidyTitle(quoted[1]);
  }
  // "Mandatory planning meeting" says nothing; the subject usually names which meeting.
  const generic = t.match(GENERIC);
  if (generic) {
    const seg = (cleanSubject(subject) ?? '').split(/\s+[-|–]\s+/).find(function (s) { return s.toLowerCase().includes(generic[1].toLowerCase()); });
    if (seg && seg.split(' ').length > t.split(' ').length - 1) t = tidyTitle(seg);
  }
  if (t.length < 3) return block.heading ? tidyTitle(block.heading) || null : null;
  return t;
}

function tidyTitle(raw: string): string {
  // "AGPC (Asian Grad/Professional community) Kickoff": asides are not part of the name.
  let t = raw.replace(/\s*—\s*/g, ': ').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  for (let i = 0; i < 4; i++) {
    const before = t;
    t = t.replace(LEAD, '').replace(TIME_LEAD, '').replace(TRAIL, '').replace(TIME_TRAIL, '').replace(RECUR_TRAIL, '').replace(WD_ABBR_TRAIL, '').trim();
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
  const verb = t.search(VERB);
  if (verb > 0 && t.slice(0, verb).includes(' ')) {
    t = t.slice(0, verb).replace(/^the\s+/i, '').replace(/\b(session|meeting|night|workshop)s$/i, '$1');
  }
  // "Kitchen Table Talks, a YC3 conversation series on ..." -> "Kitchen Table Talks".
  t = t.replace(/,\s+an?\s+.*$/, '');
  // "HALLOWOADS at Toad's Place": the card shows the place on its own.
  const atPlace = t.match(/^(.{3,}?)\s+(?:at|in)\s+(?:the\s+)?(.+)$/i);
  if (atPlace && findPlace(atPlace[2]) && findPlace(atPlace[2]) !== findPlace(atPlace[1])) t = atPlace[1];

  const label = t.match(/^([A-Z0-9][A-Z0-9 &'+-]*[A-Z0-9]):\s+(.+)$/);
  if (label && /[A-Z]{2}/.test(label[1])) {
    const head = titleCase(label[1]);
    const rest = label[2];
    const quote = rest.match(/["“]([^"”]{3,})["”]?/);
    if (quote) t = `${head}: ${quote[1]}`; // "PIZZA SEMINAR: Prof. X on \"Talk\"" -> "Pizza Seminar: Talk"
    else if (rest.toLowerCase().includes(label[1].toLowerCase())) t = rest; // "HALLOWEEN MIXER: ... Halloween Mixer"
    else if (/^[a-z]/.test(rest) && rest.split(' ').length > 5) t = head; // label then a sentence about it
    else t = `${head}: ${/^[a-z]/.test(rest) || rest === rest.toUpperCase() ? titleCase(rest) : rest}`;
  } else if (/[A-Z]/.test(t) && t === t.toUpperCase()) {
    t = titleCase(t);
  } else {
    // "Unmasking Bollywood Stereotypes: movie + discussion with Prof. Rohit De" -> the name before the description.
    const desc = t.match(/^([A-Z][^:]{2,}):\s+([a-z].*)$/);
    if (desc && desc[2].split(' ').length > 5) t = desc[1];
  }

  if (t.length > 80) t = t.slice(0, 80).replace(/\s+\S*$/, '');
  // A cap or cut can leave "(South Asian Studies" or a lone quote behind.
  if (t.lastIndexOf('(') > t.lastIndexOf(')')) t = t.slice(0, t.lastIndexOf('('));
  if ((t.match(/"/g) ?? []).length % 2 === 1) t = t.replace(/"/g, '');
  t = t.replace(/[\s,:;.!?\-–]+$/, '').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function titleCase(s: string): string {
  const small = new Set(['a', 'an', 'and', 'at', 'for', 'from', 'in', 'of', 'on', 'the', 'to', 'with', 'x', 'vs']);
  return s.split(' ').map(function (w, i) {
    const core = w.replace(/^[^A-Za-z0-9&]+|[^A-Za-z0-9&]+$/g, '');
    const acr = ACRONYMS.get(core.toUpperCase());
    if (acr) return w.replace(core, acr);
    const lw = w.toLowerCase();
    if (i > 0 && small.has(lw)) return lw;
    return lw.replace(/(^|-)([a-z])/g, function (_m, p: string, c: string) { return p + c.toUpperCase(); });
  }).join(' ');
}

function findLocation(text: string, date: DateHit, time: TimeHit): string | null {
  const lineEnd = function (i: number): number {
    const n = text.indexOf('\n', i);
    return n === -1 ? text.length : n;
  };
  const tryAfter = function (from: number): string | null {
    const seg = text.slice(from, lineEnd(from)).replace(/^\s*(?:ET|EST|EDT)\b/, '');
    const m = seg.match(/^\s*(?:[,|]\s*(?:(?:in|at|on|@)\s+)?|\s+(?:in|at|on|@)\s+)(?:the\s+)?([^.;()\n|]+)/i);
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
  const labeled = text.match(/^\s*(?:location|where|place|venue)\s*:\s*(.+)$/im);
  if (labeled) return cleanPlace(labeled[1]);
  return tryAfter(time.end) ?? (date.inBlock && date.end > time.end ? tryAfter(date.end) : null) ?? between() ?? nextLine();
}

// Card summary: the block minus the date, time, and place the sheet already shows.
function makeSummary(block: Block, shown: string[], place: string | null, title: string): string {
  if (block.nth !== undefined) return title; // a showtime line has nothing but times
  const lines = block.text.split('\n').map(function (l) { return l.replace(BULLET, '').trim(); });
  // A shouted heading line ("THE GAME", "AT DWIGHT HALL THIS WEEKEND") is the title or a section, not prose.
  if (lines.length > 1 && /[A-Z]{2}/.test(lines[0]) && lines[0] === lines[0].toUpperCase()) lines.shift();
  let s = lines.join('\n');
  const cut = function (q: string, toLineEnd: boolean): void {
    const i = s.lastIndexOf(q);
    if (i === -1) return;
    let j = i + q.length;
    const tz = s.slice(j).match(/^\s*(?:ET|EST|EDT)\b/);
    if (tz) j += tz[0].length;
    // "Susman Hall (Purple Couch Room), Slifka Center": the rest of a place line is more place.
    const nl = s.indexOf('\n', j);
    const rest = s.slice(j, nl === -1 ? s.length : nl);
    if (toLineEnd && rest.length < 40 && !/[.!?]/.test(rest)) j += rest.length;
    s = s.slice(0, i) + ' ' + s.slice(j);
  };
  for (const q of [...shown].sort(function (a, b) { return b.length - a.length; })) cut(q, false);
  // A room change should still say where it moved.
  if (place && !/\bmoved\b/i.test(s)) cut(place, true);
  s = s.replace(/\n/g, ' ').replace(/\s*—\s*/g, ', ').replace(/\(\s*[,;:\s]*\)/g, ' ').replace(/\s+/g, ' ');
  // Words left pointing at nothing: "courtyard on from ." / "comp is ." / "Panel on has moved".
  for (let k = 0; k < 3; k++) {
    s = s.replace(/\s+(?:on|at|in|from|is|are|the|and|or|by)(?=\s*(?:[.,;:)]|$))/gi, '');
    s = s.replace(/\s+(?:on|at|in)(?=\s+(?:has|have|is|are|was|will)\b)/gi, '');
  }
  s = s.replace(/\s+([.,;:!?])/g, '$1').replace(/([,;:])(?:\s*[,;:])+/g, '$1').replace(/[,;:]\s*([.!?])/g, '$1');
  s = s.replace(/([.!?]["”]?)(?:\s*[.,;:])+/g, '$1');
  s = s.replace(/^[\s.,;:!?-]+/, '').replace(/[\s,;:-]+$/, '').trim();
  // Drop a leading "GOAT YOGA." / "MATH RESEARCH PANEL:" / the title itself, unless an aside follows it.
  const words = title.split(/\s+/).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
  const lead = s.match(new RegExp(`^${words.join('(?:\\s*\\([^)]*\\))?\\s+')}(?![\\w(])[\\s.,:;!?-]*`, 'i')) ?? s.match(/^([^.:!?]{2,60})[.:!?]\s+/);
  if (lead && (lead[1] === undefined || lead[1] === lead[1].toUpperCase()) && !/^\s*\(/.test(s.slice(lead[0].length))) s = s.slice(lead[0].length);
  // What the cuts leave of the first sentence: "Is back." / "At Toad's Place." / "(on ESPNU)."
  s = s.replace(/^(?:(?:at|in|on|is|are)\s|\()[^.!?]{0,40}[.!?](?:\s+|$)/i, '');
  s = s.replace(/(^|[.?!]\s+)([a-z])/g, function (_m, p: string, c: string) { return p + c.toUpperCase(); });
  if (s.length > 240) s = s.slice(0, 240).replace(/\s+\S*$/, '');
  return s.split(/\s+/).filter(Boolean).length < 2 ? title : s;
}

// The place in one date's part of a multi-date line: "Nov 4 DL 220, Nov 11 LC 211", "1-2pm, WLH 211 and Sun Oct 18".
function segmentPlace(text: string, from: number, to: number): string | null {
  const seg = text.slice(from, to).replace(/^\s*(?:ET|EST|EDT)\b/, '').replace(/^[\s,:|]*(?:(?:in|at|@)\s+)?(?:the\s+)?/i, '');
  const cut = seg.search(/[,;()\n|]|\s+(?:and|or)\b/);
  return cleanPlace(cut === -1 ? seg : seg.slice(0, cut));
}

function onlinePlace(text: string): string | null {
  return text.match(ONLINE)?.[0] ?? null;
}

function cleanPlace(raw: string): string | null {
  const p = raw.trim().replace(/\s+as usual$/i, '').replace(/[\s,]+$/, '');
  if (!p || p.length > 70 || !/^[A-Z0-9]/.test(p) || firstMatch(TIME, p) || firstMatch(EXPLICIT_DATE, p) || /^(free|no|yes|register|bring|costumes?)\b/i.test(p)) return null;
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
    // "- Crash pads, $40 each" lines read as sentences, not one run-on.
    summary: squash(body.split('\n').map(function (l) { const t = l.replace(BULLET, '').trim(); return t && !/[.:!?]$/.test(t) ? t + '.' : t; }).join(' ')).slice(0, 240).replace(/\s+\S*$/, ''),
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

// "OCAY Members" -> "OCAY": the list is not the host.
function listHost(listName: string | null | undefined): string | null {
  const l = listName?.trim();
  if (!l) return null;
  return l.replace(/\s+(?:members|board|list|listserv|announcements)$/i, '').trim() || l;
}

// "YALE HELIX PRESENTS" at the top of a flyer names the host.
function presentsHost(body: string): string | null {
  const head = body.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).slice(0, 4);
  for (const line of head) {
    const m = line.match(/^([A-Z][\w&'.-]*(?:\s+[\w&'.-]+){0,5}?)\s+presents\b/i);
    if (m) return m[1] === m[1].toUpperCase() ? titleCase(m[1]) : m[1];
  }
  return null;
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

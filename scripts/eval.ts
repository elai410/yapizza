// Usage: pnpm eval            field accuracy of extractEvents against hand labels in fixtures/eval/expected.json.
//        pnpm eval --heldout  field accuracy of the rule-based fallback on fixtures/events.seed.json (labeled independently).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ExtractedEvent, RawEmail } from '@/lib/contracts';
import { extractEvents, rawEmailToInput } from '@/lib/pipeline/extract';
import { fallbackExtract } from '@/lib/pipeline/fallback';
import { findPlace } from '@/lib/yale';
import type { CheckedEvent } from '@/lib/pipeline/types';

interface Expected {
  title: string;
  start: string | null;
  placeId: string | null;
  freeFood: boolean;
  audience: string;
  kind: 'event' | 'listing';
}
interface Labeled { file: string; case: string; events: Expected[] }

const FIELDS = ['title', 'start', 'placeId', 'freeFood', 'audience', 'kind'] as const;
type Field = (typeof FIELDS)[number];

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}
function jaccard(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  const inter = [...x].filter((t) => y.has(t)).length;
  const union = new Set([...x, ...y]).size;
  return union ? inter / union : 0;
}
// Same instant, whatever offset format the model wrote.
function sameTime(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return a === b;
  return Date.parse(a) === Date.parse(b);
}

function check(field: Field, exp: Expected, got: CheckedEvent): boolean {
  switch (field) {
    case 'title': return jaccard(exp.title, got.title) >= 0.5;
    case 'start': return sameTime(exp.start, got.start);
    case 'placeId': return exp.placeId === got.placeId;
    case 'freeFood': return exp.freeFood === got.freeFood;
    case 'audience': return exp.audience === got.audience;
    case 'kind': return exp.kind === got.kind;
  }
}

// Greedy pairing: each expected event takes the unused extracted event with the best title overlap.
function pair(expected: Expected[], got: CheckedEvent[]): (CheckedEvent | null)[] {
  const used = new Set<number>();
  return expected.map((exp) => {
    let best = -1;
    let bestScore = 0;
    got.forEach((g, i) => {
      const s = jaccard(exp.title, g.title);
      if (!used.has(i) && s > bestScore) { best = i; bestScore = s; }
    });
    if (best < 0) return null;
    used.add(best);
    return got[best];
  });
}

async function main() {
  const root = process.cwd();
  const labels = JSON.parse(readFileSync(path.join(root, 'fixtures/eval/expected.json'), 'utf8')) as Labeled[];
  const right: Record<Field | 'count', number> = { count: 0, title: 0, start: 0, placeId: 0, freeFood: 0, audience: 0, kind: 0 };
  let totalEvents = 0;
  const modes: Record<string, number> = {};
  const misses: string[] = [];

  for (const l of labels) {
    const email = JSON.parse(readFileSync(path.join(root, 'fixtures/emails', l.file), 'utf8')) as RawEmail;
    const r = await extractEvents(rawEmailToInput(email));
    modes[r.mode] = (modes[r.mode] ?? 0) + 1;
    const lines: string[] = [];

    if (r.events.length === l.events.length) right.count++;
    else lines.push(`count: expected ${l.events.length}, got ${r.events.length}`);

    const pairs = pair(l.events, r.events);
    totalEvents += l.events.length;
    l.events.forEach((exp, i) => {
      const got = pairs[i];
      if (!got) { lines.push(`missing "${exp.title}"`); return; }
      for (const f of FIELDS) {
        if (check(f, exp, got)) right[f]++;
        else lines.push(`"${exp.title}" ${f}: expected ${JSON.stringify(exp[f])}, got ${JSON.stringify(got[f])}`);
      }
    });
    if (lines.length) misses.push(`${l.file} (${l.case}, ${r.mode})\n  ${lines.join('\n  ')}`);
  }

  const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : 'n/a');
  const rows: [string, number, number][] = [
    ['count', right.count, labels.length],
    ...FIELDS.map((f) => [f, right[f], totalEvents] as [string, number, number]),
  ];
  const sumRight = rows.reduce((s, [, n]) => s + n, 0);
  const sumAll = rows.reduce((s, [, , d]) => s + d, 0);

  console.log(`\nEval: ${labels.length} emails, ${totalEvents} expected events, mode ${Object.entries(modes).map(([m, n]) => `${m}=${n}`).join(' ')}\n`);
  console.log('field      correct   accuracy');
  for (const [name, n, d] of rows) console.log(`${name.padEnd(10)} ${`${n}/${d}`.padStart(7)}   ${pct(n, d).padStart(8)}`);
  console.log(`${'overall'.padEnd(10)} ${`${sumRight}/${sumAll}`.padStart(7)}   ${pct(sumRight, sumAll).padStart(8)}`);
  console.log(misses.length ? `\nMisses:\n${misses.join('\n')}` : '\nNo misses.');
}

// Self-check for the title rule the table depends on.
if (jaccard('Math Research Panel', 'MATH RESEARCH PANEL with Prof. Adelstein') < 0.5) throw new Error('jaccard self-check');
if (jaccard('Pset night', 'Putnam problem session') !== 0) throw new Error('jaccard self-check');

// ---------- held-out: fixtures/events.seed.json through fallbackExtract ----------

type SeedEntry = ExtractedEvent & { rawText: string; listName?: string; subject?: string; sentAt?: string };
const HELD = ['found', 'start', 'end', 'allDay', 'place', 'freeFood', 'title'] as const;
type HeldField = (typeof HELD)[number];

// Seed placeIds are short names ("WLH 211"), ours are slugs: compare what findPlace makes of each side.
function samePlace(exp: SeedEntry, got: ExtractedEvent): boolean {
  const e = findPlace(exp.placeId) ?? findPlace(exp.locationRaw);
  const g = (got.placeId ? { id: got.placeId } : null) ?? findPlace(got.locationRaw);
  if (e || g) return e?.id === g?.id;
  const er = (exp.locationRaw ?? exp.placeId ?? '').toLowerCase().trim();
  const gr = (got.locationRaw ?? '').toLowerCase().trim();
  if (!er || !gr) return er === gr;
  return er.includes(gr) || gr.includes(er);
}

function heldCheck(f: Exclude<HeldField, 'found'>, exp: SeedEntry, got: ExtractedEvent): boolean {
  switch (f) {
    case 'start': return sameTime(exp.start ?? null, got.start);
    case 'end': return sameTime(exp.end ?? null, got.end);
    case 'allDay': return !!exp.allDay === got.allDay;
    case 'place': return samePlace(exp, got);
    case 'freeFood': return !!exp.freeFood === got.freeFood;
    case 'title': return jaccard(exp.title, got.title) >= 0.5;
  }
}

// One line can hold several events; the label pairs with the one at its start, else the closest title.
function pickFor(exp: SeedEntry, got: ExtractedEvent[]): ExtractedEvent | null {
  return got.find((g) => sameTime(exp.start ?? null, g.start))
    ?? [...got].sort((a, b) => jaccard(exp.title, b.title) - jaccard(exp.title, a.title))[0]
    ?? null;
}

function heldout() {
  const seed = JSON.parse(readFileSync(path.join(process.cwd(), 'fixtures/events.seed.json'), 'utf8')) as SeedEntry[];
  const right: Record<HeldField, number> = { found: 0, start: 0, end: 0, allDay: 0, place: 0, freeFood: 0, title: 0 };
  const misses: { n: number; text: string }[] = [];
  let withEnd = 0;

  for (const exp of seed) {
    // Sent 3 days before the event, so "this Friday" resolves as it would for that week's email.
    const sentAt = exp.start ? new Date(Date.parse(exp.start) - 3 * 86400000).toISOString() : exp.sentAt;
    const r = fallbackExtract({ text: exp.rawText, listName: exp.listName, subject: exp.subject, sentAt });
    const got = pickFor(exp, r.events);
    if (exp.end) withEnd++;
    const wrong: string[] = [];
    if (got) right.found++;
    else wrong.push('found');
    for (const f of HELD) {
      if (f === 'found' || (f === 'end' && !exp.end)) continue;
      if (got && heldCheck(f, exp, got)) right[f]++;
      else if (got) {
        const pair: Record<typeof f, [unknown, unknown]> = {
          start: [exp.start, got.start], end: [exp.end, got.end], allDay: [exp.allDay, got.allDay],
          place: [exp.placeId ?? exp.locationRaw, got.placeId ?? got.locationRaw], freeFood: [exp.freeFood, got.freeFood], title: [exp.title, got.title],
        };
        wrong.push(`${f}: expected ${JSON.stringify(pair[f][0])}, got ${JSON.stringify(pair[f][1])}`);
      }
    }
    if (wrong.length) misses.push({ n: got ? wrong.length : 99, text: `${JSON.stringify(exp.rawText.slice(0, 160))}\n    ${wrong.join('\n    ')}` });
  }

  const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(0)}%` : 'n/a');
  console.log(`\nHeld-out: ${seed.length} labeled events from fixtures/events.seed.json, rule-based fallback\n`);
  console.log('field      correct   accuracy');
  let sr = 0;
  let sa = 0;
  for (const f of HELD) {
    const d = f === 'end' ? withEnd : seed.length;
    sr += right[f];
    sa += d;
    console.log(`${f.padEnd(10)} ${`${right[f]}/${d}`.padStart(7)}   ${pct(right[f], d).padStart(8)}`);
  }
  console.log(`${'overall'.padEnd(10)} ${`${sr}/${sa}`.padStart(7)}   ${pct(sr, sa).padStart(8)}`);
  misses.sort((a, b) => b.n - a.n);
  console.log(`\nWorst ${Math.min(25, misses.length)} of ${misses.length} misses:\n${misses.slice(0, 25).map((m) => `  ${m.text}`).join('\n')}`);
}

(process.argv.includes('--heldout') ? Promise.resolve().then(heldout) : main()).catch((err) => {
  console.error(err);
}).finally(() => process.exit(0));

// Usage: pnpm eval
// Field accuracy of extractEvents against hand labels in fixtures/eval/expected.json.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { RawEmail } from '@/lib/contracts';
import { extractEvents, rawEmailToInput } from '@/lib/pipeline/extract';
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

main().catch((err) => {
  console.error(err);
}).finally(() => process.exit(0));

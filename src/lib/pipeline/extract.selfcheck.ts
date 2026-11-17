// Run: pnpm tsx --env-file=.env src/lib/pipeline/extract.selfcheck.ts
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { RawEmail } from '@/lib/contracts';
import { evidenceOk } from './evidence';
import { extractionSchema } from './schema';
import { extractEvents, rawEmailToInput } from './extract';
import { FALLBACK_LIVE_WHEN_EVIDENCE_OK } from './fallback';

const src = 'Saturday 10/17, 1:30-3:30pm on the HoC\n  Patio. It’s free.';
assert.equal(evidenceOk(['saturday 10/17'], src), true, 'case-insensitive');
assert.equal(evidenceOk(['on the HoC Patio'], src), true, 'whitespace collapsed');
assert.equal(evidenceOk(["It's free"], src), true, 'curly quotes normalized');
assert.equal(evidenceOk(['1:30–3:30pm'], src), true, 'en dash normalized');
assert.equal(evidenceOk(['Saturday 10/17', 'in WLH 309'], src), false, 'missing quote');
assert.equal(evidenceOk([], src), false, 'empty evidence');

const parsed = extractionSchema.parse({
  events: [
    {
      kind: 'event', title: 'Goat Yoga', start: '2026-10-17T13:30:00-04:00', end: '2026-10-17T15:30:00-04:00',
      allDay: false, locationRaw: 'HoC Patio', placeId: null, hostName: 'Silliman GA', summary: 'Yoga with goats.',
      tags: ['social'], freeFood: false, food: null, audience: 'college_only', college: 'Silliman', rsvpUrl: null,
      price: null, evidence: ['Saturday 10/17, 1:30-3:30pm'], confidence: 0.9,
    },
  ],
  flagged: false,
  flagReason: null,
});
assert.equal(parsed.events[0].title, 'Goat Yoga');
assert.throws(() => extractionSchema.parse({ events: [{ title: 'x' }], flagged: false, flagReason: null }));

async function main() {
  const dir = path.join(process.cwd(), 'fixtures/emails');
  const file = readdirSync(dir).find((f) => f.startsWith('01-'))!;
  const email = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as RawEmail;
  const r = await extractEvents(rawEmailToInput(email), new Date('2026-10-14T20:00:00Z'));
  if (!process.env.XAI_API_KEY) {
    assert.equal(r.mode, 'fallback', 'no key and no replay -> fallback');
    assert.ok(r.events.length >= 1, 'fallback finds at least one event');
    assert.ok(r.events.every((e) => e.kind === 'listing' || e.status === (FALLBACK_LIVE_WHEN_EVIDENCE_OK ? 'live' : 'review')), 'fallback status follows FALLBACK_LIVE_WHEN_EVIDENCE_OK');
  } else {
    assert.ok(r.events.length >= 1);
  }
  console.log(`extract selfcheck ok (mode=${r.mode}, events=${r.events.length})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

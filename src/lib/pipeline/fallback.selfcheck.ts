// Run: pnpm tsx src/lib/pipeline/fallback.selfcheck.ts
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { RawEmail } from '@/lib/contracts';
import { fallbackExtract } from './fallback';

const DIR = path.join(process.cwd(), 'fixtures/emails');

function run(file: string) {
  const e = JSON.parse(readFileSync(path.join(DIR, file), 'utf8')) as RawEmail;
  return { e, r: fallbackExtract({ text: e.text, subject: e.subject, from: e.from, listName: e.listName, sentAt: e.sentAt }) };
}

const norm = function (s: string): string { return s.toLowerCase().replace(/\s+/g, ' ').trim(); };

// 01: two events, the first is Goat Yoga with a pm range.
{
  const { r } = run('01-silliman-ga-goat-yoga.json');
  assert.equal(r.events.length, 2);
  const [yoga, pots] = r.events;
  assert.match(yoga.title, /^goat yoga$/i);
  assert.equal(yoga.start, '2026-10-17T13:30:00-04:00');
  assert.equal(yoga.end, '2026-10-17T15:30:00-04:00');
  assert.equal(yoga.locationRaw, 'HoC Patio');
  assert.equal(yoga.hostName, 'Silliman GA');
  assert.equal(yoga.confidence, 0.5);
  assert.equal(pots.start, '2026-10-26T18:30:00-04:00');
}

// 08: three bullets, one with pizza; "Monday" resolves against sentAt (Sun Oct 25).
{
  const { r } = run('08-yums-weekly-oct-26.json');
  assert.equal(r.events.length, 3);
  assert.equal(r.events[0].start, '2026-10-26T19:00:00-04:00');
  const seminar = r.events[1];
  assert.equal(seminar.start, '2026-10-29T19:00:00-04:00');
  assert.equal(seminar.freeFood, true);
  assert.ok(seminar.tags.includes('free_food') && seminar.tags.includes('academic'));
  assert.equal(r.events[2].freeFood, false);
}

// 25: bullets take their date from the "MON 11/9" header; EST offset after DST ends.
{
  const { r } = run('25-glc-weekly-nov-9.json');
  assert.equal(r.events.length, 6);
  assert.equal(r.events[0].start, '2026-11-09T15:00:00-05:00');
  assert.equal(r.events[3].title, 'Wellness Wednesday');
  assert.equal(r.events[3].start, '2026-11-11T14:00:00-05:00');
}

// 30: registrar dates and deadlines, nothing to attend.
assert.equal(run('30-registrar-spring-registration.json').r.events.length, 0);

// 37: sale post becomes a listing.
{
  const { r } = run('37-ocay-gear-sale.json');
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].kind, 'listing');
  assert.equal(r.events[0].price, '$40 each');
}

// 36 and 39: members only, and the room change names the new room.
assert.equal(run('36-ocay-trip-leaders-members-only.json').r.events[0].audience, 'members_only');
assert.equal(run('39-yums-panel-room-change.json').r.events[0].locationRaw, 'LC 102');

// Every fixture: evidence is quoted from the source, times are well formed.
for (const file of readdirSync(DIR).filter(function (f) { return f.endsWith('.json'); })) {
  const { e, r } = run(file);
  assert.equal(r.flagged, false);
  for (const ev of r.events) {
    for (const q of ev.evidence) assert.ok(norm(e.text).includes(norm(q)), `${file}: evidence "${q}" not in text`);
    if (ev.kind === 'event') {
      assert.match(ev.start ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00-0[45]:00$/, `${file}: start ${ev.start}`);
      if (ev.end) assert.ok(new Date(ev.end) > new Date(ev.start!), `${file}: end before start`);
    }
  }
}

console.log('fallback selfcheck ok');

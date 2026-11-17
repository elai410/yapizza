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

// Titles: no shouted labels, no timing lead-ins, no section headings, no speaker-as-title, acronyms kept.
{
  const titles = function (f: string): string[] { return run(f).r.events.map(function (ev) { return ev.title; }); };
  assert.equal(titles('01-silliman-ga-goat-yoga.json')[1], 'Painting Plant Pots');
  assert.deepEqual(titles('08-yums-weekly-oct-26.json').slice(1), ['Pizza Seminar: Gluing Polygons, Topology, and Gaussian Integrals', 'MMATHS Test-Solving']);
  assert.equal(titles('10-yasss-stargazing-oct-29.json')[1], 'YASSS x SPS x WIP Astro + Physics Halloween Mixer');
  assert.deepEqual(titles('20-yums-pizza-weil.json'), ['Pizza Seminar: The Weil Conjectures', 'Putnam problem session']);
  assert.equal(run('20-yums-pizza-weil.json').r.events[0].freeFood, true);
  assert.equal(titles('21-aasa-night-market-aacc.json')[0], 'AASA Night Market');
  assert.equal(titles('22-aasa-night-market-dwight.json')[0], 'Asian American Students Alliance Night Market');
  assert.equal(titles('34-yums-weekly-nov-16.json')[2], 'Math Research Panel: Thinking About REUs');
  assert.equal(titles('36-ocay-trip-leaders-members-only.json')[0], 'Winter break trip meeting');
  assert.equal(titles('37-ocay-gear-sale.json')[0], 'Gear sale');
  for (const f of readdirSync(DIR).filter(function (x) { return x.endsWith('.json'); })) {
    for (const t of titles(f)) {
      assert.ok(t.length <= 80 && !t.includes('—') && !/[\s,:;.!?(-]$/.test(t), `${f}: title "${t}"`);
      assert.ok(!(/[A-Z]{4}/.test(t) && t === t.toUpperCase()), `${f}: shouted title "${t}"`);
    }
  }
}

// Times and places: time before the date, midnight shows, showtimes sharing one venue, teas are not food.
{
  const craft = run('05-glc-weekly-oct-19.json').r.events.find(function (ev) { return ev.title === 'Craft et Veritas'; });
  assert.equal(craft?.start, '2026-10-19T15:00:00-04:00');
  assert.equal(craft?.placeId, 'commons');
  const yso = run('13-arts-weekly-oct-30.json').r.events.find(function (ev) { return /YSO/.test(ev.title); });
  assert.equal(yso?.start, '2026-11-01T00:00:00-04:00');
  const shows = run('24-dramat-come-from-away.json').r.events;
  assert.deepEqual(shows.map(function (ev) { return ev.start; }), ['2026-11-12T19:30:00-05:00', '2026-11-13T19:30:00-05:00', '2026-11-14T13:30:00-05:00', '2026-11-14T19:30:00-05:00']);
  assert.ok(shows.every(function (ev) { return ev.placeId === 'university-theatre'; }));
  assert.equal(run('06-silliman-hoc-tea-chatas.json').r.events[0].freeFood, false);
}

// Summaries leave out the date, time, and place the sheet shows.
assert.equal(run('34-yums-weekly-nov-16.json').r.events[2].summary, 'Come hear from students who did them, with Prof. Ian Adelstein.');
assert.equal(run('40-aacc-politics-purse-canceled.json').r.events[0].summary, 'Unfortunately, Politics of the Purse is canceled. We hope to reschedule in the spring.');
assert.equal(run('39-yums-panel-room-change.json').r.events[0].summary, 'Quick update: the Math Research Panel has moved from WLH 120 to LC 102. Same time, same panel.');

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

// Hosts: list suffixes dropped; a flyer's "X PRESENTS" line names the host.
assert.equal(run('36-ocay-trip-leaders-members-only.json').r.events[0].hostName, 'OCAY');
{
  const flyer = fallbackExtract({ text: 'YALE HELIX PRESENTS\n\nFireside Chat with Robert Langer\nFRIDAY, NOV 20\n1:15 PM\nLC 101', listName: null, sentAt: '2026-11-17T12:00:00-05:00' }).events[0];
  assert.equal(flyer.hostName, 'Yale Helix');
  assert.equal(flyer.summary, 'Yale Helix presents Fireside Chat with Robert Langer.');
}

// Line formats from calendar exports and listings (held-out set, pnpm eval --heldout).
{
  const one = function (text: string, sentAt = '2026-11-01T12:00:00-05:00') { return fallbackExtract({ text, sentAt }).events; };
  const iso = one('Fall Fest | 2026-10-17T11:00:00-04:00 - 13:30 | SOM Room 2210 | [Primary]', '2026-10-14T12:00:00-04:00');
  assert.deepEqual([iso[0].title, iso[0].start, iso[0].end, iso[0].placeId], ['Fall Fest', '2026-10-17T11:00:00-04:00', '2026-10-17T13:30:00-04:00', 'som']);
  const two = one('Info sessions - Sat Nov 7, 1-2pm, WLH 211 and Sun Nov 8, 4-5pm, LC 207 (applications due Nov 9, 11:59pm)');
  assert.deepEqual(two.map(function (e) { return [e.start, e.placeId]; }), [['2026-11-07T13:00:00-05:00', 'wlh'], ['2026-11-08T16:00:00-05:00', 'lc']]);
  const listed = one('Putnam sessions - Wednesdays 7-9pm: Nov 4 DL 220, Nov 11 LC 211 (exam Sat Dec 5)');
  assert.deepEqual(listed.map(function (e) { return [e.start, e.placeId]; }), [['2026-11-04T19:00:00-05:00', 'dl'], ['2026-11-11T19:00:00-05:00', 'lc']]);
  const parts = one('Trainings: Intermediate HPC - Mon Nov 9, 1-4pm, YCRC Auditorium; Matlab - Wed Nov 11, 10am-12pm, Sterling Hall of Medicine C-103');
  assert.deepEqual(parts.map(function (e) { return e.title; }), ['Trainings: Intermediate HPC', 'Matlab']);
  const allDay = one('Restaurant Week - Nov 2-14; discounted lunches');
  assert.deepEqual([allDay[0].allDay, allDay[0].start, allDay[0].end], [true, '2026-11-02T00:00:00-05:00', '2026-11-14T23:59:00-05:00']);
  assert.equal(one('Roshni 2026, Fri Nov 6.').length, 0); // a date in prose with no time stays skipped
  assert.equal(one('Game Night - weekly Wednesdays 6-7pm, AACC Game Room').length, 0); // weekly with no date stays skipped
  for (const e of [...iso, ...two, ...listed, ...parts, ...allDay]) assert.ok(e.evidence.length > 0);
}

console.log('fallback selfcheck ok');

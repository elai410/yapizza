import assert from 'node:assert';
import { gcalTemplateUrl, toIcs } from './index';

const dates = (u: string) => new URL(u).searchParams.get('dates');

const evening = gcalTemplateUrl({ title: 'Talk', start: '2026-11-17T19:30:00-05:00', end: null, allDay: false, summary: 'S', rsvpUrl: 'https://x.test' });
assert.equal(dates(evening), '20261118T003000Z/20261118T013000Z');
assert.match(new URL(evening).searchParams.get('details') ?? '', /RSVP: https:\/\/x\.test/);

const allDay = gcalTemplateUrl({ title: 'Fair', start: '2026-11-21T00:00:00-05:00', end: null, allDay: true });
assert.equal(dates(allDay), '20261121/20261122');

const ics = toIcs(
  [
    { id: 'x', title: 'Talk', start: '2026-11-17T19:30:00-05:00', end: null, allDay: false, placeName: 'WLH 309' },
    { id: 'y', title: 'Fair', start: '2026-11-21T00:00:00-05:00', end: null, allDay: true, status: 'canceled' },
  ],
  'Yapizza',
);
assert.ok(ics.includes('BEGIN:VEVENT'));
assert.ok(ics.includes('UID:x@yapizza'));
assert.ok(ics.includes('X-WR-CALNAME:Yapizza'));
assert.ok(ics.includes('STATUS:CANCELLED'));
assert.ok(ics.includes('DTSTART:20261118T003000Z'));
assert.ok(ics.includes('DTSTART;VALUE=DATE:20261121'));
console.log('calendar check passed');

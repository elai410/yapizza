import assert from 'node:assert';
import { mergeDelta } from './hooks';
import { FIXTURE_EVENTS } from './fixtures';

const [a, b, c] = FIXTURE_EVENTS;
const prev = { events: [a, b], serverTime: 't0' };
const moved = { ...b, placeName: 'LC 102', updatedFields: ['placeId'] };
const out = mergeDelta(prev, { events: [moved, c], serverTime: 't1' });
assert.equal(out.serverTime, 't1');
assert.equal(out.events.length, 3);
assert.equal(out.events.find(function (e) { return e.id === b.id; })?.placeName, 'LC 102');
assert.deepEqual(out.events.map(function (e) { return e.start; }), [...out.events.map(function (e) { return e.start; })].sort(function (x, y) { return Date.parse(x) - Date.parse(y); }));
assert.equal(mergeDelta(prev, { events: [], serverTime: 't2' }).events.length, 2);
console.log('merge self-check passed');

// Run: pnpm tsx src/lib/yale/selfcheck.ts
import assert from 'node:assert/strict';
import { PLACES, COLLEGES, findPlace, normalizeCollege, placeName, placesContext, GLOSSARY } from './index';

assert.equal(COLLEGES.length, 14);
assert.equal(new Set(PLACES.map(function (p) { return p.id; })).size, PLACES.length, 'place ids unique');
for (const p of PLACES) for (const a of p.aliases) assert.equal(a, a.toLowerCase(), 'alias lowercase: ' + a);

assert.equal(findPlace('in WLH 309')?.id, 'wlh');
assert.equal(findPlace('1:30-3:30pm on the HoC Patio')?.id, 'silliman-hoc-house');
assert.equal(findPlace('6:30-7:30pm in the Acorn')?.id, 'silliman-acorn');
assert.equal(findPlace('Cross Campus in front of Sterling')?.id, 'cross-campus');
assert.equal(findPlace('Sterling Hall of Medicine C-103')?.id, 'sterling-hall-of-medicine');
assert.equal(findPlace('Davenport College Common Room')?.id, 'davenport-common-room');
assert.equal(findPlace('5:15pm, Pauli Murray Dining Hall')?.id, 'pauli-murray-dining-hall');
assert.equal(findPlace('JE buttery tonight')?.id, 'jonathan-edwards-buttery');
assert.equal(findPlace('2-3pm, YSC GLC Lounge')?.id, 'good-life-center');
assert.equal(findPlace('Thu Nov 19, 4:30-6pm, AACC MPR')?.id, 'aacc');
assert.equal(findPlace('moved from WLH 120 to LC 102')?.id, 'wlh'); // equal length: first alias found wins; extraction picks the new room
assert.equal(findPlace('LC 101')?.id, 'lc');
assert.equal(findPlace('Commons, Schwarzman Center')?.id, 'commons');
assert.equal(findPlace('bassoon recital'), null);
assert.equal(findPlace('new LCD screens'), null);
assert.equal(findPlace('nothing here'), null);
assert.equal(findPlace(null), null);

assert.equal(normalizeCollege('JE'), 'Jonathan Edwards');
assert.equal(normalizeCollege('Dport'), 'Davenport');
assert.equal(normalizeCollege('Silliman College'), 'Silliman');
assert.equal(normalizeCollege(' td '), 'Timothy Dwight');
assert.equal(normalizeCollege('Harvard'), null);
assert.equal(normalizeCollege(null), null);

assert.equal(placeName('wlh'), 'WLH');
assert.equal(placeName('nope'), null);
assert.equal(placeName(null), null);
assert.ok(placesContext().includes('wlh: WLH'));
assert.ok(GLOSSARY.includes('HoC'));

console.log('yale selfcheck ok: ' + PLACES.length + ' places');

// Run: pnpm tsx src/lib/search/parse.selfcheck.ts
import assert from 'node:assert/strict';
import { parseQuery } from './index';

const now = new Date('2026-11-17T17:30:00-05:00'); // Tue

let p = parseQuery('free food tonight', now);
assert.equal(p.freeFood, true);
assert.equal(p.when, 'Tonight');
assert.equal(p.from.toISOString(), '2026-11-17T21:00:00.000Z'); // now minus 90 min
assert.equal(p.to?.toISOString(), '2026-11-18T05:00:00.000Z');
assert.deepEqual(p.keywords, []);

p = parseQuery('Anything in JE this weekend?', now);
assert.equal(p.college, 'Jonathan Edwards');
assert.equal(p.from.toISOString(), '2026-11-20T05:00:00.000Z'); // Fri 00:00 NY
assert.equal(p.to?.toISOString(), '2026-11-23T05:00:00.000Z'); // Mon 00:00 NY
assert.deepEqual(p.keywords, []);

p = parseQuery('career talks with pizza tomorrow', now);
assert.deepEqual(p.tags, ['professional', 'academic']);
assert.deepEqual(p.keywords, ['pizza']);
assert.equal(p.when, 'Tomorrow');
assert.equal(p.freeFood, false);

p = parseQuery('Silliman college tea', now);
assert.equal(p.college, 'Silliman');
assert.deepEqual(p.keywords, ['tea']);
assert.equal(p.to, null);

console.log('search parse selfcheck ok');

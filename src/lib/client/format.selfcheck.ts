import assert from 'node:assert';
import { formatRange } from './format';

assert.equal(formatRange('2026-11-17T14:00:00-05:00', '2026-11-17T16:00:00-05:00'), 'Tue, Nov 17 · 2:00 to 4:00 PM');
assert.equal(formatRange('2026-11-17T00:00:00-05:00', null, true), 'Tue, Nov 17 · All day');
assert.equal(formatRange('2026-11-17T00:00:00-05:00', '2026-11-17T23:59:00-05:00', true), 'Tue, Nov 17 · All day');
assert.equal(formatRange('2026-11-02T00:00:00-05:00', '2026-11-06T23:59:00-05:00', true), 'Mon, Nov 2 to Fri, Nov 6 · All day');
assert.equal(formatRange('2026-11-02T10:00:00-05:00', '2026-11-06T17:00:00-05:00'), 'Mon, Nov 2 · 10:00 AM to Fri, Nov 6 · 5:00 PM');
console.log('format self-check passed');

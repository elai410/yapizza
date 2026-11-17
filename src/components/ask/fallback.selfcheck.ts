import assert from 'node:assert';
import { fallbackParams } from './useAsk';

const a = fallbackParams('free food tonight');
assert.equal(a.get('freeFood'), 'true');
assert.equal(a.get('q'), null);
const b = fallbackParams('career talks this week');
assert.equal(b.get('tags'), 'professional');
assert.equal(b.get('q'), null);
const c = fallbackParams('anything in Davenport');
assert.equal(c.get('college'), 'Davenport');
assert.equal(c.get('q'), null);
assert.equal(fallbackParams('webinar').get('q'), 'webinar');
console.log('ask fallback self-check passed');
assert.equal(fallbackParams('pizza tonight').get('q'), null);

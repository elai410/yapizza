import assert from 'node:assert';
import { highlightSegments, missingQuotes } from './highlight';

function joined(t: string, q: string[]) {
  return highlightSegments(t, q).map(function (s) { return s.text; }).join('');
}

const text = 'Join us Thursday at\n  6 PM in WLH 309 (6 PM) for pizza.';

// case and whitespace insensitive
const s1 = highlightSegments(text, ['thursday AT 6 pm']);
assert.deepStrictEqual(s1.filter(function (s) { return s.hit; }).map(function (s) { return s.text; }), ['Thursday at\n  6 PM']);

// regex characters in a quote
const s2 = highlightSegments(text, ['(6 PM)']);
assert.deepStrictEqual(s2.filter(function (s) { return s.hit; }).map(function (s) { return s.text; }), ['(6 PM)']);

// empty quotes list
assert.deepStrictEqual(highlightSegments(text, []), [{ text, hit: false }]);
assert.deepStrictEqual(highlightSegments('', []), [{ text: '', hit: false }]);

// overlapping and duplicate quotes, and concatenation always equals input
for (const q of [['WLH 309', 'WLH', 'WLH 309'], ['6 PM', 'PM in WLH'], ['', '  '], ['pizza.'], ['nope']]) {
  assert.strictEqual(joined(text, q), text);
}

// missing quotes are reported
assert.deepStrictEqual(missingQuotes(text, ['WLH 309', 'Sudler Hall']), ['Sudler Hall']);

console.log('highlight self-check passed');

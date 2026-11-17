export interface Segment {
  text: string;
  hit: boolean;
}

function quotePattern(q: string): string {
  return q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

// Matches the server's evidence check: case-insensitive, whitespace runs collapsed.
export function evidenceRegex(quotes: string[]): RegExp | null {
  const parts = quotes
    .filter(function (q) { return q.trim().length > 0; })
    // longest first so overlapping quotes prefer the fuller match
    .sort(function (a, b) { return b.length - a.length; })
    .map(quotePattern);
  return parts.length ? new RegExp(parts.join('|'), 'gi') : null;
}

export function highlightSegments(text: string, quotes: string[]): Segment[] {
  const re = evidenceRegex(quotes);
  if (!re) return [{ text, hit: false }];
  const out: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), hit: false });
    out.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length || out.length === 0) out.push({ text: text.slice(last), hit: false });
  return out;
}

export function missingQuotes(text: string, quotes: string[]): string[] {
  return quotes.filter(function (q) {
    const re = evidenceRegex([q]);
    return re !== null && !re.test(text);
  });
}

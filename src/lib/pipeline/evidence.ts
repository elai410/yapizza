function norm(s: string): string {
  return s
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// True only when there is at least one quote and every quote appears in the source.
export function evidenceOk(quotes: string[], source: string): boolean {
  if (quotes.length === 0) return false;
  const src = norm(source);
  return quotes.every((q) => {
    const n = norm(q);
    return n.length > 0 && src.includes(n);
  });
}

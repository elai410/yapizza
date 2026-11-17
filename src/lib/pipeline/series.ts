import { z } from 'zod';
import { formatInTimeZone } from 'date-fns-tz';
import { grokJson, GrokReplayMiss } from '@/lib/grok';
import { loadPrompt } from './digest';

const TZ = 'America/New_York';

// Fallback tradition check on the lowercased title, whole words.
export const TRADITION_KEYWORDS = [
  'the game', 'harvard-yale', 'harvard yale', 'handsome dan', 'spring fling', 'feb club',
  'bonfire', 'holiday dinner', 'primal scream',
] as const;

export interface SeriesInput { id: string; title: string; start: string; hostName: string | null }

export interface DetectedSeries {
  title: string;
  hostName: string | null;
  eventIds: string[];
  typicalMonth: number | null;
  yearsSeen: number[];
  isTradition: boolean;
}

const MONTH_WORDS = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b/g;
const WEEKDAYS = /\b(?:mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|rsday|urday)?\b/g;

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(MONTH_WORDS, ' ')
    .replace(WEEKDAYS, ' ')
    .replace(/#\s*\d+/g, ' ')
    .replace(/\d+(?:st|nd|rd|th)?/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isTraditionTitle(title: string): boolean {
  const t = title.toLowerCase();
  return TRADITION_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`).test(t));
}

function toSeries(events: SeriesInput[], title: string, isTradition: boolean): DetectedSeries {
  const sorted = [...events].sort((a, b) => (a.start < b.start ? -1 : 1));
  const months = sorted.map((e) => Number(formatInTimeZone(new Date(e.start), TZ, 'M')));
  const counts = new Map<number, number>();
  for (const m of months) counts.set(m, (counts.get(m) ?? 0) + 1);
  const typicalMonth = [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
  const yearsSeen = [...new Set(sorted.map((e) => Number(formatInTimeZone(new Date(e.start), TZ, 'yyyy'))))].sort();
  return { title, hostName: sorted[0]?.hostName ?? null, eventIds: sorted.map((e) => e.id), typicalMonth, yearsSeen, isTradition };
}

const seriesSchema = z.object({
  series: z.array(z.object({ groups: z.array(z.number()), title: z.string(), isTradition: z.boolean() })),
});

export async function detectSeries(events: SeriesInput[]): Promise<DetectedSeries[]> {
  // Rule pass: same normalized title and host.
  const byKey = new Map<string, SeriesInput[]>();
  for (const e of events) {
    const key = `${normalizeTitle(e.title)}|${(e.hostName ?? '').toLowerCase().trim()}`;
    byKey.set(key, [...(byKey.get(key) ?? []), e]);
  }
  const groups = [...byKey.values()];
  const ruleResult = groups
    .filter((g) => g.length >= 2 || isTraditionTitle(g[0].title))
    .map((g) => toSeries(g, g[0].title, isTraditionTitle(g[0].title)));
  if (groups.length === 0) return [];

  try {
    const { version, body } = loadPrompt('series.md');
    const user = groups
      .map((g, i) => {
        const when = [...new Set(g.map((e) => formatInTimeZone(new Date(e.start), TZ, 'MMM yyyy')))].join(', ');
        return `${i}. ${JSON.stringify(g[0].title)} | host: ${g[0].hostName ?? 'unknown'} | events: ${g.length} | ${when}`;
      })
      .join('\n');
    const { data } = await grokJson({ name: 'series', promptVersion: version, schema: seriesSchema, system: body, user, reasoningEffort: 'medium' });

    const used = new Set<number>();
    const out: DetectedSeries[] = [];
    for (const s of data.series) {
      const idx = [...new Set(s.groups)].filter((i) => Number.isInteger(i) && i >= 0 && i < groups.length && !used.has(i));
      const evs = idx.flatMap((i) => groups[i]);
      if (!evs.length || (evs.length < 2 && !s.isTradition)) continue;
      idx.forEach((i) => used.add(i));
      out.push(toSeries(evs, s.title.trim() || evs[0].title, s.isTradition));
    }
    // Rule series Grok left out still count.
    groups.forEach((g, i) => {
      if (!used.has(i) && g.length >= 2) out.push(toSeries(g, g[0].title, isTraditionTitle(g[0].title)));
    });
    return out;
  } catch (err) {
    if (err instanceof GrokReplayMiss) console.log('[series] replay miss, using rules');
    else console.error('[series] grok failed, using rules:', err);
    return ruleResult;
  }
}

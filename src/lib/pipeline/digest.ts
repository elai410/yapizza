import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { formatInTimeZone } from 'date-fns-tz';
import type { EventCard } from '@/lib/contracts';
import { grokJson, GrokReplayMiss } from '@/lib/grok';

const TZ = 'America/New_York';
const MAX_PICKS = 8;
const BLUE = '#00356B';

export interface Digest {
  subject: string;
  html: string;
  text: string;
  eventIds: string[];
  mode: 'grok' | 'fallback';
}

// Same format as prompts/extract.md: first line "version: <id>", then the prompt body.
export function loadPrompt(file: string): { version: string; body: string } {
  const raw = readFileSync(path.join(process.cwd(), 'src/lib/pipeline/prompts', file), 'utf8');
  const [first, ...rest] = raw.split('\n');
  const m = /^version:\s*(\S+)/.exec(first);
  if (!m) throw new Error(`${file}: missing version line`);
  return { version: m[1], body: rest.join('\n').trim() };
}

const digestSchema = z.object({
  subject: z.string(),
  intro: z.string(),
  picks: z.array(z.object({ id: z.string(), line: z.string() })),
});

// Copy rules (CLAUDE.md 11.3): no exclamation marks, no em dashes.
function clean(s: string): string {
  return s.replace(/!+/g, '.').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function eventLine(e: EventCard): string {
  const time = e.allDay ? 'All day' : formatInTimeZone(new Date(e.start), TZ, 'h:mm a');
  return [time, e.title, e.placeName].filter(Boolean).join(' · ');
}

function fallbackLine(e: EventCard): string {
  if (e.freeFood) return e.food ? `Free food: ${e.food}` : 'Free food';
  return e.hostName ?? '';
}

function render(subject: string, intro: string, picks: { event: EventCard; line: string }[]): { html: string; text: string } {
  // Group by day; within a day free food first, then by start.
  const sorted = [...picks].sort((a, b) => {
    const da = formatInTimeZone(new Date(a.event.start), TZ, 'yyyy-MM-dd');
    const db = formatInTimeZone(new Date(b.event.start), TZ, 'yyyy-MM-dd');
    if (da !== db) return da < db ? -1 : 1;
    if (a.event.freeFood !== b.event.freeFood) return a.event.freeFood ? -1 : 1;
    return a.event.start < b.event.start ? -1 : a.event.start > b.event.start ? 1 : 0;
  });
  const days = new Map<string, { event: EventCard; line: string }[]>();
  for (const p of sorted) {
    const day = formatInTimeZone(new Date(p.event.start), TZ, 'EEE, MMM d');
    days.set(day, [...(days.get(day) ?? []), p]);
  }

  const font = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const htmlDays = [...days].map(([day, rows]) => {
    const items = rows
      .map((r) => {
        const sub = r.line ? `<div style="color:#555;font-size:14px;margin-top:2px">${esc(r.line)}</div>` : '';
        return `<li style="margin:0 0 12px;list-style:none"><div style="font-size:15px;color:#111;font-variant-numeric:tabular-nums">${esc(eventLine(r.event))}</div>${sub}</li>`;
      })
      .join('');
    return `<h2 style="color:${BLUE};font-size:16px;margin:24px 0 8px">${esc(day)}</h2><ul style="padding:0;margin:0">${items}</ul>`;
  });
  const html = `<html><head><meta charset="utf-8"><title>${esc(subject)}</title></head><body style="margin:0;padding:24px;background:#fff;${font}"><div style="max-width:560px;margin:0 auto"><h1 style="color:${BLUE};font-size:20px;margin:0 0 8px">${esc(subject)}</h1><p style="color:#111;font-size:15px;margin:0">${esc(intro)}</p>${htmlDays.join('')}</div></body></html>`;

  const text = [
    subject,
    '',
    intro,
    ...[...days].flatMap(([day, rows]) => ['', day, ...rows.map((r) => `  ${eventLine(r.event)}${r.line ? `\n    ${r.line}` : ''}`)]),
  ].join('\n');
  return { html, text };
}

export async function writeDigest(
  events: EventCard[],
  opts: { userName?: string; college?: string | null; now?: Date } = {},
): Promise<Digest> {
  const pool = events.filter((e) => e.status !== 'canceled');
  const byId = new Map(pool.map((e) => [e.id, e]));
  const now = opts.now ?? new Date();

  try {
    const { version, body } = loadPrompt('digest.md');
    // Date only, never minutes: the replay key hashes this text.
    const user = [
      `Today: ${formatInTimeZone(now, TZ, 'EEE, MMM d, yyyy')} (America/New_York)`,
      `Reader: ${opts.userName ?? 'unknown'}`,
      `College: ${opts.college ?? 'unknown'}`,
      '',
      'Events (JSON):',
      JSON.stringify(
        pool.map((e) => ({
          id: e.id,
          title: e.title,
          when: formatInTimeZone(new Date(e.start), TZ, 'EEE, MMM d h:mm a'),
          place: e.placeName,
          host: e.hostName,
          tags: e.tags,
          freeFood: e.freeFood,
          food: e.food,
          audience: e.audience,
          college: e.college,
        })),
      ),
    ].join('\n');
    const { data } = await grokJson({ name: 'digest', promptVersion: version, schema: digestSchema, system: body, user, reasoningEffort: 'low' });

    const seen = new Set<string>();
    const picks = data.picks
      .filter((p) => byId.has(p.id) && !seen.has(p.id) && seen.add(p.id))
      .slice(0, MAX_PICKS)
      .map((p) => ({ event: byId.get(p.id)!, line: clean(p.line).split(' ').slice(0, 12).join(' ') }));
    if (picks.length || pool.length === 0) {
      const subject = clean(data.subject) || `This week at Yale: ${picks.length} events`;
      const intro = clean(data.intro);
      return { subject, ...render(subject, intro, picks), eventIds: picks.map((p) => p.event.id), mode: 'grok' };
    }
    console.log('[digest] grok picked no known ids, using fallback');
  } catch (err) {
    if (err instanceof GrokReplayMiss) console.log('[digest] replay miss, using fallback');
    else console.error('[digest] grok failed, using fallback:', err);
  }

  const picks = [...pool]
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))
    .slice(0, MAX_PICKS)
    .map((event) => ({ event, line: fallbackLine(event) }));
  const subject = `This week at Yale: ${picks.length} ${picks.length === 1 ? 'event' : 'events'}`; // count what the body shows
  const intro = pool.length ? `Here is what is happening at Yale this week.` : `Nothing is on the calendar this week yet.`;
  return { subject, ...render(subject, intro, picks), eventIds: picks.map((p) => p.event.id), mode: 'fallback' };
}

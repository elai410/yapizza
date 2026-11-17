import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { EventCard, MatchDecision } from '@/lib/contracts';
import { getEvent, prisma, toNyIso } from '@/lib/db';
import { grokJson, GrokReplayMiss } from '@/lib/grok';
import { findPlace, placeName } from '@/lib/yale';
import type { CheckedEvent } from './types';

const DAY = 86_400_000;
const FIELDS = ['start', 'end', 'placeId', 'locationRaw', 'title', 'status'] as const;
type Field = (typeof FIELDS)[number];

export interface Candidate {
  id: string;
  title: string;
  start: string;
  end: string | null;
  placeId: string | null;
  locationRaw: string | null;
  hostName: string | null;
  status: string;
}

const matchSchema = z.object({
  action: z.enum(['new', 'same', 'update', 'cancel']),
  matchId: z.string().nullable(),
  changedFields: z.array(z.enum(FIELDS)),
});

let prompt: { version: string; body: string } | undefined;
function loadPrompt(): { version: string; body: string } {
  if (!prompt) {
    const raw = readFileSync(path.join(process.cwd(), 'src/lib/pipeline/prompts/match.md'), 'utf8');
    const [first, ...rest] = raw.split('\n');
    const m = /^version:\s*(\S+)/.exec(first);
    if (!m) throw new Error('match.md: missing version line');
    prompt = { version: m[1], body: rest.join('\n').trim() };
  }
  return prompt;
}

// ---------- similarity ----------

// Update words are stopwords so "ROOM CHANGE: Math Research Panel" still matches "Math Research Panel".
const STOP = new Set(
  'a an and the of for in on at to with by from is are be this that it its our your all about via vs w new now update updated reminder room change changed moved canceled cancelled cancellation postponed rescheduled'.split(' '),
);
function words(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)));
}
export function titleSimilarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / (A.size + B.size - both);
}

// "The Game" vs "The Game: Yale vs. Harvard": every word of the shorter title appears in the longer one.
function titleContained(a: string, b: string): boolean {
  const [A, B] = [words(a), words(b)];
  const [small, big] = A.size <= B.size ? [A, B] : [B, A];
  return small.size > 0 && [...small].every((w) => big.has(w));
}

const sameText = (a: string | null, b: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
const nyDay = (iso: string) => toNyIso(new Date(iso)).slice(0, 10);
const sameInstant = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

// Seed rows store short names ("Dwight Hall"), the pipeline stores slugs ("dwight-hall"): compare on the slug.
// An unknown place gives null, so free-text spellings ("Luce 101" vs "Luce Hall 101") never count as a move.
function placeKey(p: string | null): string | null {
  if (!p) return null;
  return placeName(p) ? p : (findPlace(p)?.id ?? null);
}
const room = (loc: string | null) => loc?.match(/\b(\d{2,4}[A-Za-z]?)\b/)?.[1] ?? null;

// ---------- candidates ----------

export async function findCandidates(ev: CheckedEvent): Promise<Candidate[]> {
  if (!ev.start) return [];
  const t = new Date(ev.start).getTime();
  const rows = await prisma.event.findMany({
    where: { start: { gte: new Date(t - 3 * DAY), lte: new Date(t + 3 * DAY) } },
    include: { host: true },
  });
  const evPlace = placeKey(ev.placeId ?? ev.locationRaw);
  return rows
    .map((r) => {
      const sim = titleSimilarity(ev.title, r.title);
      const sameHost = Boolean(ev.hostName && r.host && sameText(ev.hostName, r.host.name));
      // Same event on two lists can carry different hosts and titles; same start and place still pins it.
      const samePlaceTime = r.start.getTime() === t && evPlace !== null && placeKey(r.placeId ?? r.locationRaw) === evPlace;
      const sameTimeTitle = r.start.getTime() === t && titleContained(ev.title, r.title);
      return { r, sim, keep: sameHost || sim >= 0.5 || samePlaceTime || sameTimeTitle };
    })
    .filter((x) => x.keep)
    .sort((a, b) => b.sim - a.sim || Math.abs(a.r.start.getTime() - t) - Math.abs(b.r.start.getTime() - t))
    .slice(0, 5)
    .map(({ r }) => ({
      id: r.id,
      title: r.title,
      start: toNyIso(r.start),
      end: r.end ? toNyIso(r.end) : null,
      placeId: r.placeId,
      locationRaw: r.locationRaw,
      hostName: r.host?.name ?? null,
      status: r.status,
    }));
}

// ---------- decision ----------

const NEW: MatchDecision = { action: 'new', matchId: null, changedFields: [] };
const CANCEL = /\bcancel(?:l)?ed\b|\bcancel(?:l)?ation\b|no longer happening/i;

// Fields the new event states differently. A missing value is not a change.
function diff(ev: CheckedEvent, c: Candidate): Field[] {
  const out: Field[] = [];
  if (ev.start && !sameInstant(ev.start, c.start)) out.push('start');
  if (ev.end && (!c.end || !sameInstant(ev.end, c.end))) out.push('end');
  const np = placeKey(ev.placeId ?? ev.locationRaw);
  const op = placeKey(c.placeId ?? c.locationRaw);
  if (np && op && np !== op) out.push('placeId', 'locationRaw');
  else if (room(ev.locationRaw) && room(c.locationRaw) && room(ev.locationRaw) !== room(c.locationRaw)) out.push('locationRaw');
  return out;
}

function ruleMatch(ev: CheckedEvent, candidates: Candidate[], sourceText: string): MatchDecision {
  const best = candidates
    .map((c) => {
      const sim = titleSimilarity(ev.title, c.title);
      const sameHostDay = Boolean(ev.hostName && sameText(ev.hostName, c.hostName) && ev.start && nyDay(ev.start) === nyDay(c.start));
      const np = placeKey(ev.placeId ?? ev.locationRaw);
      const samePlaceTime = Boolean(ev.start && sameInstant(ev.start, c.start) && np && np === placeKey(c.placeId ?? c.locationRaw));
      const sameTimeTitle = Boolean(ev.start && sameInstant(ev.start, c.start) && titleContained(ev.title, c.title));
      return { c, sim, ok: sim >= 0.5 || sameHostDay || samePlaceTime || sameTimeTitle };
    })
    .filter((x) => x.ok)
    .sort((a, b) => b.sim - a.sim)[0]?.c;
  if (!best) return NEW;
  // shortcut: cancel is read from the event's own text or the subject line, not the whole body, so a newsletter that cancels one item doesn't cancel its siblings.
  if (CANCEL.test(ev.summary) || CANCEL.test(ev.title) || CANCEL.test(sourceText.split('\n')[0] ?? '')) {
    return { action: 'cancel', matchId: best.id, changedFields: ['status'] };
  }
  const changed = diff(ev, best);
  return changed.length ? { action: 'update', matchId: best.id, changedFields: changed } : { action: 'same', matchId: best.id, changedFields: [] };
}

export async function decideMatch(ev: CheckedEvent, candidates: Candidate[], sourceText: string): Promise<MatchDecision> {
  if (!candidates.length) return NEW;
  const { version, body } = loadPrompt();
  try {
    const { data } = await grokJson({
      name: 'match',
      promptVersion: version,
      schema: matchSchema,
      system: body,
      user: JSON.stringify({
        newEvent: {
          title: ev.title,
          start: ev.start,
          end: ev.end,
          placeId: ev.placeId,
          locationRaw: ev.locationRaw,
          hostName: ev.hostName,
          summary: ev.summary,
        },
        candidates,
        sourceText: sourceText.slice(0, 1500),
      }),
      reasoningEffort: 'medium',
    });
    if (data.action === 'new' || !candidates.some((c) => c.id === data.matchId)) return NEW;
    if (data.action === 'cancel') return { action: 'cancel', matchId: data.matchId, changedFields: ['status'] };
    if (data.action === 'same') return { action: 'same', matchId: data.matchId, changedFields: [] };
    // Never overwrite a known value with a null one.
    const changed = data.changedFields.filter((f) => f !== 'status' && ev[f] != null);
    return changed.length ? { action: 'update', matchId: data.matchId, changedFields: changed } : { action: 'same', matchId: data.matchId, changedFields: [] };
  } catch (err) {
    if (err instanceof GrokReplayMiss) console.log(`[dedup] replay miss ${err.key.slice(0, 12)}, using rules`);
    else console.error('[dedup] grok failed, using rules:', err);
    return ruleMatch(ev, candidates, sourceText);
  }
}

// ---------- apply ----------

export async function applyMatch(ev: CheckedEvent, d: MatchDecision, sourceId: string): Promise<EventCard | null> {
  if (!d.matchId || (d.action !== 'update' && d.action !== 'cancel')) return null;
  const id = d.matchId;
  if (d.action === 'cancel') {
    await prisma.event.update({ where: { id }, data: { status: 'canceled' } });
  } else {
    const f = new Set(d.changedFields);
    const cur = await prisma.event.findUniqueOrThrow({ where: { id }, select: { status: true, summary: true, locationRaw: true } });
    // Keep the summary from naming the old room ("... WLH 120" after a move to LC 102).
    const moved = f.has('locationRaw') && cur.locationRaw && ev.locationRaw && cur.summary.includes(cur.locationRaw);
    await prisma.event.update({
      where: { id },
      data: {
        ...(f.has('start') && ev.start ? { start: new Date(ev.start) } : {}),
        ...(f.has('end') && ev.end ? { end: new Date(ev.end) } : {}),
        ...(f.has('placeId') ? { placeId: ev.placeId } : {}),
        ...(f.has('locationRaw') ? { locationRaw: ev.locationRaw } : {}),
        ...(f.has('title') ? { title: ev.title } : {}),
        // The source drawer highlights these quotes in the update email, so they must come from it.
        ...(ev.evidence.length ? { evidence: JSON.stringify(ev.evidence) } : {}),
        ...(moved ? { summary: cur.summary.split(cur.locationRaw!).join(ev.locationRaw!) } : {}),
        // A low-confidence update changes the details but doesn't pull a live card off the feed.
        status: ev.status === 'review' ? cur.status : 'live',
      },
    });
  }
  await prisma.eventVersion.create({
    data: { eventId: id, changedFields: JSON.stringify(d.changedFields), fromSourceId: sourceId },
  });
  const detail = await getEvent(id);
  if (!detail) return null;
  const { summary: _s, locationRaw: _l, rsvpUrl: _r, confidence: _c, evidence: _e, gcalTemplateUrl: _g, source: _src, ...card } = detail;
  return card;
}

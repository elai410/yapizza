import { isOn, type EventCard, type IngestResult, type MatchDecision, type RawEmail } from '@/lib/contracts';
import { prisma, saveExtraction, type SaveResult } from '@/lib/db';
import { notifyFreeFood } from '@/lib/db/alerts';
import { applyMatch, decideMatch, findCandidates } from './dedup';
import { extractEvents, rawEmailToInput } from './extract';
import { readFile } from './files';
import type { CheckedEvent, CheckedExtraction } from './types';

type Matched = { ev: CheckedEvent; d: MatchDecision };

// Before save: events matching an existing one leave the save list; 'same' just drops.
// An email older than the one behind a card's latest update must not undo it (re-sending 34 after 39).
async function newerUpdateExists(eventId: string, sentAt: string): Promise<boolean> {
  const v = await prisma.eventVersion.findFirst({ where: { eventId }, orderBy: { changedAt: 'desc' }, select: { fromSourceId: true } });
  if (!v?.fromSourceId) return false;
  const src = await prisma.source.findUnique({ where: { id: v.fromSourceId }, select: { receivedAt: true } });
  return Boolean(src && src.receivedAt.getTime() > new Date(sentAt).getTime());
}

async function match(x: CheckedExtraction, sourceText: string, sentAt?: string): Promise<{ save: CheckedExtraction; matched: Matched[] }> {
  if (!isOn('DEDUP') || x.flagged) return { save: x, matched: [] };
  const keep: CheckedEvent[] = [];
  const matched: Matched[] = [];
  for (const ev of x.events) {
    if (ev.kind !== 'event' || !ev.start) {
      keep.push(ev);
      continue;
    }
    let d = await decideMatch(ev, await findCandidates(ev), sourceText);
    if (sentAt && d.matchId && d.action !== 'same' && (await newerUpdateExists(d.matchId, sentAt))) {
      d = { action: 'same', matchId: d.matchId, changedFields: [] };
    }
    console.log(`[dedup] ${ev.title} -> ${d.action}${d.matchId ? ` ${d.matchId}` : ''}${d.changedFields.length ? ` [${d.changedFields.join(',')}]` : ''}`);
    if (d.action === 'new') keep.push(ev);
    else matched.push({ ev, d });
  }
  return { save: { ...x, events: keep }, matched };
}

// After save, so EventVersion.fromSourceId points at a real Source.
async function applyAll(matched: Matched[], saved: SaveResult): Promise<EventCard[]> {
  if (saved.duplicateSource) return [];
  const cards: EventCard[] = [];
  for (const m of matched) {
    const card = await applyMatch(m.ev, m.d, saved.sourceId);
    if (card) cards.push(card);
  }
  return cards;
}

// An alert failure must never fail the ingest.
async function alertFreeFood(r: IngestResult) {
  if (!isOn('ALERTS')) return;
  await notifyFreeFood(r.created).catch((err) => console.error('[ingest] free food alert failed:', err));
}

function toResult(saved: SaveResult, updated: EventCard[], t0: number): IngestResult {
  return {
    sourceId: saved.sourceId,
    created: saved.created,
    updated,
    listings: saved.listings,
    inReview: saved.inReview,
    ms: Date.now() - t0,
  };
}

function log(label: string, x: CheckedExtraction, r: IngestResult, dup = false) {
  const review = x.events.filter((e) => e.status === 'review').length;
  console.log(`[ingest] ${label} mode=${x.mode} events=${x.events.length} review=${review}${dup ? ' duplicate' : ''} ${r.ms}ms`);
}

export async function ingestEmail(email: RawEmail, kind: 'email' | 'forward' | 'demo' = 'email'): Promise<IngestResult> {
  const t0 = Date.now();
  // Skip Grok for a message we already have; saveExtraction would discard the result anyway.
  const seen = await prisma.source.findUnique({ where: { messageId: email.messageId }, select: { id: true } });
  if (seen) return { sourceId: seen.id, created: [], updated: [], listings: 0, inReview: 0, ms: Date.now() - t0 };
  const input = rawEmailToInput(email);
  const extraction = await extractEvents(input);
  const { save, matched } = await match(extraction, `${email.subject}\n${extraction.readText ?? input.text}`, email.sentAt);
  const saved = await saveExtraction(
    {
      kind,
      messageId: email.messageId,
      sender: email.from,
      listName: email.listName ?? null,
      subject: email.subject,
      rawText: extraction.readText ?? email.text, // includes a flyer's text so the drawer can highlight its quotes
      receivedAt: email.sentAt,
    },
    save,
  );
  const result = toResult(saved, await applyAll(matched, saved), t0); // duplicateSource: created is [] already, so the call is idempotent
  await alertFreeFood(result);
  log(email.subject, extraction, result, saved.duplicateSource);
  return result;
}

// readFile rejected the file (unsupported type, too big, unreadable): a client error, not a 500.
export class FileReadError extends Error {}

export async function ingestFile(
  file: { filename: string; mimeType: string; data: Buffer },
  hostName?: string | null,
): Promise<IngestResult> {
  const t0 = Date.now();
  const read = await readFile(file, hostName).catch((err: unknown) => {
    throw new FileReadError(err instanceof Error ? err.message : String(err));
  });
  const extraction: CheckedExtraction =
    read.kind === 'input'
      ? await extractEvents(read.input)
      : { events: read.events.map((e) => ({ ...e, status: 'live' as const })), flagged: false, flagReason: null, mode: 'grok', ms: 0 }; // ICS is already structured
  if (hostName) for (const e of extraction.events) e.hostName ??= hostName;
  const rawText = extraction.readText?.trim() ? extraction.readText : read.kind === 'input' && read.input.text.trim() ? read.input.text : `[${file.mimeType.startsWith('image/') ? 'image' : 'file'}] ${file.filename}`;
  const { save, matched } = await match(extraction, `${file.filename}\n${rawText}`);
  const saved = await saveExtraction(
    {
      kind: 'upload',
      sender: null,
      listName: hostName ?? null,
      subject: file.filename,
      rawText,
    },
    save,
  );
  const result = toResult(saved, await applyAll(matched, saved), t0);
  await alertFreeFood(result);
  log(file.filename, extraction, result);
  return result;
}

import type { IngestResult, RawEmail } from '@/lib/contracts';
import { prisma, saveExtraction, type SaveResult } from '@/lib/db';
import { extractEvents, rawEmailToInput } from './extract';
import { readFile } from './files';
import type { CheckedExtraction } from './types';

function toResult(saved: SaveResult, t0: number): IngestResult {
  return {
    sourceId: saved.sourceId,
    created: saved.created,
    updated: [], // CP3: filled by dedup/match
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
  const extraction = await extractEvents(rawEmailToInput(email));
  // CP3: dedup/match goes here (MatchDecision per event before save; fills `updated`)
  const saved = await saveExtraction(
    {
      kind,
      messageId: email.messageId,
      sender: email.from,
      listName: email.listName ?? null,
      subject: email.subject,
      rawText: email.text,
      receivedAt: email.sentAt,
    },
    extraction,
  );
  const result = toResult(saved, t0); // duplicateSource: created is [] already, so the call is idempotent
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
  // CP3: dedup/match goes here (MatchDecision per event before save; fills `updated`)
  const saved = await saveExtraction(
    {
      kind: 'upload',
      sender: null,
      listName: hostName ?? null,
      subject: file.filename,
      rawText: read.kind === 'input' && read.input.text.trim() ? read.input.text : `[${file.mimeType.startsWith('image/') ? 'image' : 'file'}] ${file.filename}`,
    },
    extraction,
  );
  const result = toResult(saved, t0);
  log(file.filename, extraction, result);
  return result;
}

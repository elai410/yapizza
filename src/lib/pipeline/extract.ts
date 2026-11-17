import { readFileSync } from 'node:fs';
import path from 'node:path';
import type OpenAI from 'openai';
import { formatInTimeZone } from 'date-fns-tz';
import type { ExtractionResult, RawEmail } from '@/lib/contracts';
import { grokJson, GrokReplayMiss } from '@/lib/grok';
import { GLOSSARY, placesContext, findPlace, normalizeCollege } from '@/lib/yale';
import { fallbackExtract } from '@/lib/pipeline/fallback';
import { extractionSchema } from './schema';
import { evidenceOk } from './evidence';
import type { CheckedEvent, CheckedExtraction, ExtractInput } from './types';

const TZ = 'America/New_York';

let prompt: { version: string; body: string } | undefined;
function loadPrompt(): { version: string; body: string } {
  if (!prompt) {
    const raw = readFileSync(path.join(process.cwd(), 'src/lib/pipeline/prompts/extract.md'), 'utf8');
    const [first, ...rest] = raw.split('\n');
    const m = /^version:\s*(\S+)/.exec(first);
    if (!m) throw new Error('extract.md: missing version line');
    prompt = { version: m[1], body: rest.join('\n').trim() };
  }
  return prompt;
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function rawEmailToInput(e: RawEmail): ExtractInput {
  const images = (e.attachments ?? [])
    .filter((a) => a.mimeType.startsWith('image/'))
    .map((a) => ({ mimeType: a.mimeType, dataBase64: a.dataBase64 }));
  return {
    text: e.text?.trim() ? e.text : e.html ? stripHtml(e.html) : '',
    subject: e.subject,
    from: e.from,
    listName: e.listName ?? null,
    sentAt: e.sentAt,
    ...(images.length ? { images } : {}),
  };
}

function buildUser(input: ExtractInput, now: Date): string | OpenAI.Chat.Completions.ChatCompletionContentPart[] {
  // Date only, never minutes: the replay key hashes this text.
  const header = [
    `Today: ${formatInTimeZone(now, TZ, 'EEE, MMM d, yyyy')} (America/New_York)`,
    `Sent: ${input.sentAt ? formatInTimeZone(new Date(input.sentAt), TZ, "EEE, MMM d, yyyy h:mm a xxx") : 'unknown'}`,
    `From: ${input.from ?? 'unknown'}`,
    `List: ${input.listName ?? 'none'}`,
    `Subject: ${input.subject ?? ''}`,
  ].join('\n');
  const text = `${header}\n\n---\n${input.text}`;
  if (!input.images?.length) return text;
  return [
    { type: 'text', text },
    ...input.images.map((img) => ({
      type: 'image_url' as const,
      image_url: { url: `data:${img.mimeType};base64,${img.dataBase64}` },
    })),
  ];
}

export async function extractEvents(input: ExtractInput, now = new Date()): Promise<CheckedExtraction> {
  const t0 = Date.now();
  const { version, body } = loadPrompt();
  const system = `${body}\n\nYale glossary:\n${GLOSSARY}\n\nPlaces (id: name):\n${placesContext()}`;

  let result: ExtractionResult;
  let mode: CheckedExtraction['mode'];
  try {
    const r = await grokJson({
      name: 'extraction',
      promptVersion: version,
      schema: extractionSchema,
      system,
      user: buildUser(input, now),
      reasoningEffort: 'low',
    });
    result = r.data;
    mode = r.mode === 'replay' ? 'replay' : 'grok';
  } catch (err) {
    if (err instanceof GrokReplayMiss) console.log(`[extract] replay miss ${err.key.slice(0, 12)}, using fallback`);
    else console.error('[extract] grok failed, using fallback:', err);
    result = fallbackExtract(input, now);
    mode = 'fallback';
  }

  const sourceText = `${input.subject ?? ''}\n${input.text}`;
  const imageOnly = !input.text.trim() && Boolean(input.images?.length);

  const events: CheckedEvent[] = result.events.map((e) => {
    let { placeId } = e;
    if (!placeId && e.locationRaw) placeId = findPlace(e.locationRaw)?.id ?? null;
    const college = e.college ? normalizeCollege(e.college) : null;
    const evidenceFine = imageOnly || evidenceOk(e.evidence, sourceText);
    const review = e.kind === 'event' && (mode === 'fallback' || e.confidence < 0.7 || !evidenceFine || !e.start);
    return { ...e, placeId, college, status: review ? 'review' : 'live' };
  });

  return { events, flagged: result.flagged, flagReason: result.flagReason, mode, ms: Date.now() - t0 };
}

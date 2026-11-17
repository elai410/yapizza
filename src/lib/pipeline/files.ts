// Server-only: uses Buffer, unpdf, node-ical (the server-only package is not installed).
import { extractText, getDocumentProxy } from 'unpdf';
import Papa from 'papaparse';
import ical from 'node-ical';
import { formatInTimeZone } from 'date-fns-tz';
import type { ExtractedEvent } from '@/lib/contracts';
import type { ExtractInput } from './types';

export type FileRead =
  | { kind: 'input'; input: ExtractInput }          // goes to extractEvents (Grok text or vision)
  | { kind: 'events'; events: ExtractedEvent[] };   // already structured (ICS): skip Grok

const TZ = 'America/New_York';
const ISO = "yyyy-MM-dd'T'HH:mm:ssXXX";
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const FOOD = /pizza|food|dinner|lunch|snack|refreshment/i;

type FileKind = 'image' | 'pdf' | 'csv' | 'ics' | 'text';

function detect(mimeType: string, filename: string): FileKind | null {
  const m = mimeType.toLowerCase().split(';')[0].trim();
  if (m.startsWith('image/')) return 'image';
  if (m === 'application/pdf') return 'pdf';
  if (m === 'text/csv') return 'csv';
  if (m === 'text/calendar') return 'ics';
  if (m === 'text/plain' || m === 'message/rfc822') return 'text';
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || ext === 'gif') return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'csv') return 'csv';
  if (ext === 'ics') return 'ics';
  if (ext === 'txt' || ext === 'eml') return 'text';
  return null;
}

function imageMime(mimeType: string, filename: string): string {
  if (mimeType.startsWith('image/')) return mimeType;
  const ext = filename.toLowerCase().split('.').pop();
  return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
}

function val(v: string | { val: string } | undefined): string | null {
  if (v == null) return null;
  return (typeof v === 'string' ? v : v.val)?.trim() || null;
}

function readIcs(text: string, hostName: string | null): ExtractedEvent[] {
  const data = ical.sync.parseICS(text);
  const events: ExtractedEvent[] = [];
  // shortcut: RRULE recurrences are not expanded (first instance only); expand with ical.expandRecurringEvent if clubs send series.
  for (const c of Object.values(data)) {
    if (!c || c.type !== 'VEVENT') continue;
    const allDay = c.datetype === 'date';
    // node-ical builds date-only values at local midnight; read local parts so the day never shifts across zones.
    const fmt = (d: Date) => allDay
      ? formatInTimeZone(new Date(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T12:00:00Z`), TZ, "yyyy-MM-dd'T'00:00:00XXX")
      : formatInTimeZone(d, TZ, ISO);
    const title = val(c.summary) ?? 'Untitled event';
    const description = val(c.description);
    const organizer = c.organizer && typeof c.organizer !== 'string' ? c.organizer.params?.CN ?? null : null;
    const block = text.split(/BEGIN:VEVENT/).find(function (b) { return b.includes(c.uid); });
    const dtLine = block?.match(/^DTSTART[^\r\n]*/m)?.[0];
    events.push({
      kind: 'event',
      title,
      start: fmt(c.start),
      end: c.end ? fmt(c.end) : null,
      allDay,
      locationRaw: val(c.location),
      placeId: null,
      hostName: hostName ?? organizer ?? null,
      summary: description?.slice(0, 500) || title,
      tags: [],
      freeFood: FOOD.test(`${title} ${description ?? ''}`),
      food: null,
      audience: 'open_to_all',
      college: null,
      rsvpUrl: c.url ?? null,
      price: null,
      evidence: [dtLine ?? title],
      confidence: 0.95,
    });
  }
  return events;
}

export async function readFile(
  file: { filename: string; mimeType: string; data: Buffer },
  hostName?: string | null,
): Promise<FileRead> {
  const { filename, mimeType, data } = file;
  const listName = hostName ?? null;
  switch (detect(mimeType, filename)) {
    case 'image': {
      if (data.byteLength > MAX_IMAGE_BYTES) throw new Error('image is larger than 20 MiB');
      return {
        kind: 'input',
        input: { text: '', subject: filename, listName, images: [{ mimeType: imageMime(mimeType, filename), dataBase64: data.toString('base64') }] },
      };
    }
    case 'pdf': {
      const pdf = await getDocumentProxy(new Uint8Array(data));
      const { text } = await extractText(pdf, { mergePages: true });
      // shortcut: scanned PDFs (no text layer) are rejected; upgrade with unpdf renderPageAsImage -> vision input.
      if (text.trim().length < 40) throw new Error('pdf has no text layer');
      return { kind: 'input', input: { text: text.trim(), subject: filename, listName } };
    }
    case 'csv': {
      const parsed = Papa.parse<Record<string, string>>(data.toString('utf8'), { header: true, skipEmptyLines: true });
      const lines = parsed.data.map(function (row) {
        return Object.entries(row)
          .filter(function ([, v]) { return v != null && String(v).trim() !== ''; })
          .map(function ([k, v]) { return `${k}: ${String(v).trim()}`; })
          .join('; ');
      });
      return { kind: 'input', input: { text: lines.join('\n'), subject: filename, listName } };
    }
    case 'ics':
      return { kind: 'events', events: readIcs(data.toString('utf8'), listName) };
    case 'text':
      return { kind: 'input', input: { text: data.toString('utf8'), subject: filename, listName } };
    default:
      throw new Error(`unsupported file type: ${mimeType}`);
  }
}

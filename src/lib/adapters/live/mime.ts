import { simpleParser, type AddressObject } from 'mailparser';
import type { RawEmail } from '@/lib/contracts';

const KEEP_MIME = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/csv|text\/calendar)$/;

const addresses = (a: AddressObject | AddressObject[] | undefined): string[] =>
  (Array.isArray(a) ? a : a ? [a] : []).flatMap((o) => o.value.map((v) => v.address ?? '')).filter(Boolean);

// "Yale Dance Club <dance.lists.yale.edu>" -> "Yale Dance Club"
function listIdName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const name = raw.replace(/^list-id:\s*/i, '').split('<')[0].trim().replace(/^"|"$/g, '');
  return name || undefined;
}

/** Parse a MIME message (Gmail raw, or an .eml file) into a RawEmail. */
export async function parseMime(buf: Buffer, fallbackId: string): Promise<RawEmail> {
  const parsed = await simpleParser(buf);
  const listLine = parsed.headerLines.find((h) => h.key === 'list-id')?.line;
  const fromName = parsed.from?.value[0]?.name || undefined;
  return {
    messageId: parsed.messageId ?? fallbackId,
    from: parsed.from?.text ?? '',
    to: addresses(parsed.to),
    subject: parsed.subject ?? '',
    text: parsed.text ?? (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : ''),
    html: parsed.html || undefined,
    listName: listIdName(listLine) ?? fromName,
    sentAt: (parsed.date ?? new Date()).toISOString(),
    attachments: parsed.attachments
      .filter((a) => KEEP_MIME.test(a.contentType))
      .map((a) => ({ filename: a.filename ?? 'attachment', mimeType: a.contentType, dataBase64: a.content.toString('base64') })),
  };
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';
import { simpleParser, type AddressObject } from 'mailparser';
import type { MailSource, RawEmail } from '@/lib/contracts';
import { simMail } from '../sim/mail';
import { oauthClient } from './google';

const SEEN_FILE = path.join(process.cwd(), '.sim', 'gmail-seen.json');
const KEEP_MIME = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/csv|text\/calendar)$/;

async function readSeen(): Promise<string[]> {
  try {
    return JSON.parse(await readFile(SEEN_FILE, 'utf8')) as string[];
  } catch {
    return [];
  }
}

async function writeSeen(ids: string[]) {
  await mkdir(path.dirname(SEEN_FILE), { recursive: true });
  // shortcut: file grows forever, trim to the last N ids if it ever matters.
  await writeFile(SEEN_FILE, JSON.stringify(ids));
}

const addresses = (a: AddressObject | AddressObject[] | undefined): string[] =>
  (Array.isArray(a) ? a : a ? [a] : []).flatMap((o) => o.value.map((v) => v.address ?? '')).filter(Boolean);

// "Yale Dance Club <dance.lists.yale.edu>" -> "Yale Dance Club"
function listIdName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const name = raw.replace(/^list-id:\s*/i, '').split('<')[0].trim().replace(/^"|"$/g, '');
  return name || undefined;
}

async function toRawEmail(gmailId: string, raw: string): Promise<RawEmail> {
  const parsed = await simpleParser(Buffer.from(raw, 'base64url'));
  const listLine = parsed.headerLines.find((h) => h.key === 'list-id')?.line;
  const fromName = parsed.from?.value[0]?.name || undefined;
  return {
    messageId: parsed.messageId ?? gmailId,
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

export const liveGmail: MailSource = {
  mode: 'live',
  async pull() {
    const out: RawEmail[] = [];
    try {
      const auth = oauthClient();
      auth.setCredentials({ refresh_token: process.env.GMAIL_INTAKE_REFRESH_TOKEN });
      const gmail = google.gmail({ version: 'v1', auth });
      const list = await gmail.users.messages.list({ userId: 'me', q: 'newer_than:2d -in:sent', maxResults: 20 });
      const seen = await readSeen();
      const ids = (list.data.messages ?? []).map((m) => m.id).filter((id): id is string => !!id && !seen.includes(id));
      for (const id of ids) {
        const msg = await gmail.users.messages.get({ userId: 'me', id, format: 'raw' });
        if (!msg.data.raw) continue;
        out.push(await toRawEmail(id, msg.data.raw));
        seen.push(id);
        await writeSeen(seen);
      }
      return out;
    } catch (err) {
      // Never throws to the caller. Return what already converted (those ids are marked seen); the rest retry next pull.
      console.error('[gmail] pull failed:', err instanceof Error ? err.message : err);
      return out;
    }
  },
  inject: (email) => simMail.inject(email),
};

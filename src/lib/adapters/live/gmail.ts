import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { google } from 'googleapis';
import type { MailSource, RawEmail } from '@/lib/contracts';
import { simMail } from '../sim/mail';
import { parseMime } from './mime';
import { oauthClient } from './google';

const SEEN_FILE = path.join(process.cwd(), '.sim', 'gmail-seen.json');

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
        out.push(await parseMime(Buffer.from(msg.data.raw, 'base64url'), id));
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

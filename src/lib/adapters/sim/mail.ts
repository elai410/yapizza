import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { MailSource, RawEmail } from '@/lib/contracts';
import { parseMime } from '../live/mime';

export interface SimInboxEntry {
  email: RawEmail;
  at: string;
}

const INBOX_CAP = 200; // display list only; the pull queue is separate so the cap never drops unpulled mail

// globalThis so the inbox survives Next dev hot reloads.
const g = globalThis as unknown as { ypSimMail?: { injected: SimInboxEntry[]; queue: RawEmail[] } };
const state = (g.ypSimMail ??= { injected: [], queue: [] });
state.queue ??= []; // state from before the queue existed survives HMR

const FIXTURE_DIR = path.join(process.cwd(), 'fixtures', 'emails');

const isRawEmail = (v: unknown): v is RawEmail => {
  const e = v as Partial<RawEmail> | null;
  return !!e && typeof e.messageId === 'string' && typeof e.subject === 'string' && typeof e.text === 'string' && typeof e.from === 'string';
};

async function loadDir(dir: string, prefix: string): Promise<{ file: string; email: RawEmail }[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).filter((f) => f.endsWith('.json') || f.endsWith('.eml')).sort();
  } catch {
    return []; // real/ is optional and gitignored
  }
  const out: { file: string; email: RawEmail }[] = [];
  for (const name of names) {
    const file = prefix + name;
    try {
      const buf = await readFile(path.join(dir, name));
      const email: unknown = name.endsWith('.eml') ? await parseMime(buf, file) : JSON.parse(buf.toString('utf8'));
      if (isRawEmail(email)) out.push({ file, email: { ...email, to: Array.isArray(email.to) ? email.to : [], sentAt: email.sentAt ?? new Date().toISOString() } });
      else console.warn(`[sim-mail] skipping ${file}: not a RawEmail (needs messageId, from, subject, text)`);
    } catch (err) {
      console.warn(`[sim-mail] skipping ${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return out;
}

/** Real forwarded emails (fixtures/emails/real, .json or .eml) first, then the built-in fixtures. Read fresh each call. */
export async function fixtureEmails(): Promise<{ file: string; email: RawEmail }[]> {
  const [real, built] = await Promise.all([loadDir(path.join(FIXTURE_DIR, 'real'), 'real/'), loadDir(FIXTURE_DIR, '')]);
  return [...real, ...built];
}

export const simInbox = (): SimInboxEntry[] => state.injected;

export function resetSimMail() {
  state.injected = [];
  state.queue = [];
}

export const simMail: MailSource = {
  mode: 'sim',
  async pull() {
    const fresh = state.queue;
    state.queue = [];
    return fresh;
  },
  async inject(email) {
    state.queue.push(email);
    state.injected.unshift({ email, at: new Date().toISOString() });
    if (state.injected.length > INBOX_CAP) state.injected.length = INBOX_CAP;
  },
};

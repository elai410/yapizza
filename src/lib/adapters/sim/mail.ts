import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { MailSource, RawEmail } from '@/lib/contracts';

export interface SimInboxEntry {
  email: RawEmail;
  at: string;
}

// globalThis so the inbox survives Next dev hot reloads.
const g = globalThis as unknown as { ypSimMail?: { injected: SimInboxEntry[]; pulled: number } };
const state = (g.ypSimMail ??= { injected: [], pulled: 0 });

let fixtures: { file: string; email: RawEmail }[] | null = null;

export function fixtureEmails(): { file: string; email: RawEmail }[] {
  if (fixtures) return fixtures;
  const dir = path.join(process.cwd(), 'fixtures', 'emails');
  fixtures = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => ({ file, email: JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as RawEmail }));
  return fixtures;
}

export const simInbox = (): SimInboxEntry[] => state.injected;

export function resetSimMail() {
  state.injected = [];
  state.pulled = 0;
}

export const simMail: MailSource = {
  mode: 'sim',
  async pull() {
    // injected is newest first, so the unpulled ones are at the front.
    const fresh = state.injected.slice(0, state.injected.length - state.pulled);
    state.pulled = state.injected.length;
    return fresh.reverse().map((e) => e.email);
  },
  async inject(email) {
    state.injected.unshift({ email, at: new Date().toISOString() });
  },
};

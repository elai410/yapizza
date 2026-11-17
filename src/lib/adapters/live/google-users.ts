import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Auth } from 'googleapis';
import type { SessionUser } from '@/lib/contracts';
import { prisma } from '@/lib/db';

export interface GoogleUser {
  tokens: Auth.Credentials;
  user: SessionUser;
  email: string;
}

export const STATE_COOKIE = 'yp_oauth_state';

const FILE = path.join(process.cwd(), '.sim', 'google-users.json');

export function readGoogleUsers(): Record<string, GoogleUser> {
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, GoogleUser>;
  } catch {
    return {};
  }
}

export const getGoogleUser = (userId: string): GoogleUser | null => readGoogleUsers()[userId] ?? null;

export function saveGoogleUser(g: GoogleUser) {
  const all = readGoogleUsers();
  all[g.user.id] = g;
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(all, null, 2));
}

/** Merge refreshed tokens; Google omits refresh_token on refresh, so keep the old one. */
export function updateGoogleTokens(userId: string, tokens: Auth.Credentials) {
  const g = getGoogleUser(userId);
  if (g) saveGoogleUser({ ...g, tokens: { ...g.tokens, ...tokens } });
}

/** Saves need a User row for every signed-in session user. */
export async function upsertUserRow(u: SessionUser, extra: { gcalConnected?: boolean } = {}) {
  await prisma.user.upsert({
    where: { id: u.id },
    create: { id: u.id, netid: u.netid, name: u.name, college: u.college, ...extra },
    update: { name: u.name, college: u.college, ...extra },
  });
}

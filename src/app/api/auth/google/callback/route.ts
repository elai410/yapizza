import { google } from 'googleapis';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { oauthClient } from '@/lib/adapters/live/google';
import { STATE_COOKIE, saveGoogleUser, upsertUserRow } from '@/lib/adapters/live/google-users';
import { SESSION_COOKIE } from '@/lib/adapters/sim/auth';
import type { SessionUser } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

async function signIn(req: Request): Promise<boolean> {
  try {
    const url = new URL(req.url);
    const jar = await cookies();
    const expected = jar.get(STATE_COOKIE)?.value;
    jar.delete(STATE_COOKIE);
    const code = url.searchParams.get('code');
    if (!code || !expected || url.searchParams.get('state') !== expected) throw new Error('bad state or missing code');

    const auth = oauthClient();
    const { tokens } = await auth.getToken(code);
    auth.setCredentials(tokens);
    const { data } = await google.oauth2({ version: 'v2', auth }).userinfo.get();
    if (!data.id || !data.email) throw new Error('userinfo missing id or email');

    const user: SessionUser = {
      id: `g-${data.id}`,
      netid: data.email.split('@')[0],
      name: data.name ?? data.email,
      college: null,
    };
    saveGoogleUser({ tokens, user, email: data.email });
    await upsertUserRow(user, { gcalConnected: true });
    jar.set(SESSION_COOKIE, user.id, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return true;
  } catch (err) {
    console.error('[auth] google callback failed:', err instanceof Error ? err.message : err);
    return false;
  }
}

// redirect() throws, so it stays outside the try block.
export async function GET(req: Request) {
  redirect((await signIn(req)) ? '/' : '/?signin=failed');
}

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { googleConfigured } from '@/lib/adapters/env';
import { oauthClient } from '@/lib/adapters/live/google';
import { STATE_COOKIE } from '@/lib/adapters/live/google-users';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!googleConfigured()) redirect('/?signin=sim');
  const state = crypto.randomUUID();
  (await cookies()).set(STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 });
  redirect(
    oauthClient().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['openid', 'email', 'profile', 'https://www.googleapis.com/auth/calendar.events'],
      state,
    }),
  );
}

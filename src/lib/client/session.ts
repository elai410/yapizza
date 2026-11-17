'use client';

import useSWR from 'swr';
import type { IntegrationMode, SessionUser } from '@/lib/contracts';

type AuthState = { user: SessionUser | null; students: SessionUser[]; mode: IntegrationMode; googleAvailable: boolean };

// GET/POST /api/auth (integrations): current user, demo students, and sign-in as one of them.
export function useSession() {
  const { data, mutate, isLoading } = useSWR<AuthState>('/api/auth', async function (url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  });
  async function signIn(userId: string) {
    const res = await fetch('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId }) });
    if (!res.ok) throw new Error(String(res.status));
    await mutate();
  }
  async function signOut() {
    await fetch('/api/auth', { method: 'DELETE' });
    await mutate();
  }
  return { user: data?.user ?? null, students: data?.students ?? [], googleAvailable: data?.googleAvailable ?? false, isLoading, signIn, signOut };
}

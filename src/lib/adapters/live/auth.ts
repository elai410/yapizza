import { cookies } from 'next/headers';
import type { AuthProvider } from '@/lib/contracts';
import { DEMO_STUDENTS } from '../demo-students';
import { SESSION_COOKIE } from '../sim/auth';
import { getGoogleUser } from './google-users';

export const liveAuth: AuthProvider = {
  mode: 'live',
  async currentUser() {
    const id = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!id) return null;
    // The 5 demo students keep working alongside Google sign-in.
    if (id.startsWith('g-')) return getGoogleUser(id)?.user ?? null;
    return DEMO_STUDENTS.find((s) => s.id === id) ?? null;
  },
};

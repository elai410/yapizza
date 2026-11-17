import { cookies } from 'next/headers';
import type { AuthProvider } from '@/lib/contracts';
import { DEMO_STUDENTS } from '../demo-students';

export const SESSION_COOKIE = 'yp_user';

export const simAuth: AuthProvider = {
  mode: 'sim',
  async currentUser() {
    const id = (await cookies()).get(SESSION_COOKIE)?.value;
    return DEMO_STUDENTS.find((s) => s.id === id) ?? null;
  },
};

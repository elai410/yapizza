import { cookies } from 'next/headers';
import { adapters } from '@/lib/adapters';
import { DEMO_STUDENTS } from '@/lib/adapters/demo-students';
import { SESSION_COOKIE } from '@/lib/adapters/sim/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = adapters.auth();
  return Response.json({
    user: await auth.currentUser(),
    students: auth.mode === 'sim' ? DEMO_STUDENTS : [],
    mode: auth.mode,
  });
}

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const userId = body && typeof body === 'object' && 'userId' in body ? body.userId : null;
  const user = DEMO_STUDENTS.find((s) => s.id === userId);
  if (!user) return Response.json({ error: 'unknown userId' }, { status: 400 });
  (await cookies()).set(SESSION_COOKIE, user.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return Response.json({ user });
}

export async function DELETE() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { isOn } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { cancelEvent } from '@/lib/db/host';

export const dynamic = 'force-dynamic';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isOn('HOST')) return new NextResponse('Not found', { status: 404 });
  const user = await adapters.auth().currentUser();
  if (!user) return NextResponse.json({ error: 'sign in' }, { status: 401 });
  const { id } = await ctx.params;
  const res = await cancelEvent(id, user.netid);
  if (!res.ok) return NextResponse.json({ error: res.status === 404 ? 'not found' : 'not your event' }, { status: res.status });
  return NextResponse.json({ ok: true });
}

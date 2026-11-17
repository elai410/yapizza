import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isOn } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { claimHost } from '@/lib/db/host';

export const dynamic = 'force-dynamic';

const Body = z.object({ hostId: z.string().min(1) });

export async function POST(req: Request) {
  if (!isOn('HOST')) return new NextResponse('Not found', { status: 404 });
  const user = await adapters.auth().currentUser();
  if (!user) return NextResponse.json({ error: 'sign in' }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'hostId required' }, { status: 400 });
  const res = await claimHost(body.data.hostId, user.netid);
  if (!res.ok) {
    const error = res.status === 404 ? 'not found' : 'claimed by another officer';
    return NextResponse.json({ error }, { status: res.status });
  }
  return NextResponse.json(res);
}

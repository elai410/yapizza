import { NextResponse } from 'next/server';
import { isOn } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { myHosts } from '@/lib/db/host';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isOn('HOST')) return new NextResponse('Not found', { status: 404 });
  const user = await adapters.auth().currentUser();
  if (!user) return NextResponse.json({ error: 'sign in' }, { status: 401 });
  return NextResponse.json({ hosts: await myHosts(user.netid) });
}

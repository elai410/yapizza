import { NextResponse, type NextRequest } from 'next/server';
import { isOn } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { searchHosts } from '@/lib/db/host';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isOn('HOST')) return new NextResponse('Not found', { status: 404 });
  if (!(await adapters.auth().currentUser())) return NextResponse.json({ error: 'sign in' }, { status: 401 });
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 100);
  return NextResponse.json({ hosts: await searchHosts(q) });
}

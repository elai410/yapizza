import { NextResponse } from 'next/server';
import { isOn } from '@/lib/contracts';
import { listTraditions } from '@/lib/db/listings';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isOn('TRADITIONS')) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json({ traditions: await listTraditions() });
}

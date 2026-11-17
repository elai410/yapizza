import { NextResponse } from 'next/server';
import { isOn } from '@/lib/contracts';
import { listListings } from '@/lib/db/listings';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isOn('SALES')) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json({ listings: await listListings() });
}

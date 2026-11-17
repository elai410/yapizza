import { NextResponse, type NextRequest } from 'next/server';
import { isOn } from '@/lib/contracts';
import { buildDigest } from '@/lib/db/digest';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isOn('DIGEST')) return new NextResponse('Not found', { status: 404 });
  return NextResponse.json(await buildDigest(req.nextUrl.searchParams.get('userId') || undefined));
}

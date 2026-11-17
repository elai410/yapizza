import { NextResponse } from 'next/server';
import { isOn } from '@/lib/contracts';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isOn('DEMO_PANEL')) return new NextResponse('Not found', { status: 404 });
  const notifications = await prisma.notification.findMany({ orderBy: { sentAt: 'desc' }, take: 20 });
  return NextResponse.json({ notifications });
}

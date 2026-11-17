import { NextResponse } from 'next/server';
import { isOn } from '@/lib/contracts';
import { getEvent } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isOn('FEED')) return new NextResponse('Not found', { status: 404 });
  const { id } = await ctx.params;
  const event = await getEvent(id);
  if (!event) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(event);
}

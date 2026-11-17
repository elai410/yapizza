import { NextResponse } from 'next/server';
import { isOn, type OkResponse } from '@/lib/contracts';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// The detail sheet calls this once when a student opens it; GET /api/events/[id] no longer counts views,
// so refetches and scripts don't inflate host reach.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isOn('FEED')) return new NextResponse('Not found', { status: 404 });
  const { id } = await ctx.params;
  // Raw SQL so updatedAt stays put; otherwise every view would resurface the card in `since` polling.
  const n = await prisma.$executeRaw`UPDATE "Event" SET "views" = "views" + 1 WHERE "id" = ${id}`;
  if (!n) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ ok: true } satisfies OkResponse);
}

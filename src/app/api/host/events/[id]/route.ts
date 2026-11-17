import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isOn } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { editEvent } from '@/lib/db/host';

export const dynamic = 'force-dynamic';

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date');
const Patch = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  start: isoDate.optional(),
  end: isoDate.nullable().optional(),
  placeId: z.string().max(100).nullable().optional(),
  locationRaw: z.string().max(300).nullable().optional(),
  summary: z.string().max(2000).optional(),
  rsvpUrl: z.url().nullable().optional(),
  freeFood: z.boolean().optional(),
  food: z.string().max(200).nullable().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isOn('HOST')) return new NextResponse('Not found', { status: 404 });
  const user = await adapters.auth().currentUser();
  if (!user) return NextResponse.json({ error: 'sign in' }, { status: 401 });
  const body = Patch.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? 'invalid body' }, { status: 400 });
  const { id } = await ctx.params;
  const res = await editEvent(id, user.netid, body.data);
  if (!res.ok) return NextResponse.json({ error: res.status === 404 ? 'not found' : 'not your event' }, { status: res.status });
  return NextResponse.json(res.value);
}

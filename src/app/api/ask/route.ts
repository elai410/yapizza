import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isOn, type AskResponse } from '@/lib/contracts';
import { keywordAsk } from '@/lib/search';
import { grokAsk } from '@/lib/search/grok-ask';

export const dynamic = 'force-dynamic';

const ASK_DEADLINE_MS = 12_000; // Haiku measured 3.1 to 6.1 s on demo queries (18:3x); headroom for stage Wi-Fi

const Body = z.object({ q: z.string().trim().min(1).max(300) });

export async function POST(req: Request) {
  if (!isOn('ASK')) return new NextResponse('Not found', { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'q is required' }, { status: 400 });

  let res: AskResponse;
  try {
    // On stage, a slow network must not hold the answer: after 12 s the keyword fallback answers instead.
    res = await Promise.race([
      grokAsk(parsed.data.q),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('grok ask timed out after 12s')), ASK_DEADLINE_MS)),
    ]);
  } catch (err) {
    if (!(err instanceof Error && err.message === 'grok unavailable')) console.error('[ask] grok failed, using keyword fallback', err);
    res = await keywordAsk(parsed.data.q);
  }
  return NextResponse.json(res);
}

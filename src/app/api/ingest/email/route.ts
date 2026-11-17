import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isOn, type RawEmail } from '@/lib/contracts';
import { ingestEmail } from '@/lib/pipeline/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RawEmailSchema = z.object({
  messageId: z.string().min(1),
  from: z.string(),
  to: z.array(z.string()).default([]),
  subject: z.string(),
  text: z.string(),
  html: z.string().optional(),
  listName: z.string().optional(),
  sentAt: z.string().default(() => new Date().toISOString()),
  attachments: z
    .array(z.object({ filename: z.string(), mimeType: z.string(), dataBase64: z.string() }))
    .optional(),
});

export async function POST(req: Request) {
  if (!isOn('INGEST')) return new NextResponse('Not found', { status: 404 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body must be JSON' }, { status: 400 });
  }
  const parsed = RawEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, { status: 400 });
  }
  try {
    return NextResponse.json(await ingestEmail(parsed.data satisfies RawEmail));
  } catch (err) {
    console.error('[ingest/email]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { isOn } from '@/lib/contracts';
import { FileReadError, ingestFile } from '@/lib/pipeline/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  if (!isOn('UPLOAD')) return new NextResponse('Not found', { status: 404 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'expected multipart form data' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file is larger than 20 MiB' }, { status: 413 });
  const hostName = form.get('hostName');
  const input = {
    filename: file.name || 'upload',
    mimeType: file.type || 'application/octet-stream',
    data: Buffer.from(await file.arrayBuffer()),
  };
  const host = typeof hostName === 'string' && hostName.trim() ? hostName.trim() : null;
  try {
    return NextResponse.json(await ingestFile(input, host));
  } catch (err) {
    if (err instanceof FileReadError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error('[upload]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

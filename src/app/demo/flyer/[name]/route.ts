import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { isOn } from '@/lib/contracts';

export const dynamic = 'force-dynamic';

const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
};

export async function GET(_req: Request, ctx: RouteContext<'/demo/flyer/[name]'>) {
  const { name } = await ctx.params;
  const type = TYPES[path.extname(name).toLowerCase()];
  if (!isOn('DEMO_PANEL') || !type || name.includes('/') || name.includes('\\') || name.includes('..')) {
    return new Response('Not found', { status: 404 });
  }
  const dir = path.join(process.cwd(), 'fixtures/flyers');
  const names = await readdir(dir).catch(function () { return [] as string[]; });
  if (!names.includes(name)) return new Response('Not found', { status: 404 });
  const body = await readFile(path.join(dir, name));
  return new Response(new Uint8Array(body), { headers: { 'content-type': type, 'cache-control': 'no-store' } });
}

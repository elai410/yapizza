// Usage: pnpm extract <path-to-RawEmail.json | fixture prefix like 01>
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { RawEmail } from '@/lib/contracts';
import { extractEvents, rawEmailToInput } from '@/lib/pipeline/extract';

function resolve(arg: string): string {
  if (existsSync(arg)) return arg;
  const dir = path.join(process.cwd(), 'fixtures/emails');
  const hit = readdirSync(dir).find((f) => f.endsWith('.json') && f.startsWith(`${arg}-`));
  if (!hit) throw new Error(`no fixture matches "${arg}" in fixtures/emails`);
  return path.join(dir, hit);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('usage: pnpm extract <RawEmail.json | 01>');
    process.exit(1);
  }
  const file = resolve(arg);
  const email = JSON.parse(readFileSync(file, 'utf8')) as RawEmail;
  const r = await extractEvents(rawEmailToInput(email));

  console.log(`\n${path.basename(file)}  "${email.subject}"`);
  console.log(`mode=${r.mode}  ms=${r.ms}  events=${r.events.length}${r.flagged ? `  FLAGGED: ${r.flagReason}` : ''}\n`);
  for (const e of r.events) {
    console.log(`[${e.status}] ${e.kind === 'listing' ? '(listing) ' : ''}${e.title}`);
    console.log(`  when:  ${e.start ?? '?'} – ${e.end ?? ''}${e.allDay ? ' (all day)' : ''}`);
    console.log(`  where: ${e.locationRaw ?? '?'}  placeId=${e.placeId ?? 'null'}`);
    console.log(`  host:  ${e.hostName ?? '?'}  audience=${e.audience}${e.college ? `  college=${e.college}` : ''}`);
    console.log(`  tags:  ${e.tags.join(', ') || '-'}  freeFood=${e.freeFood}${e.food ? ` (${e.food})` : ''}${e.price ? `  price=${e.price}` : ''}`);
    console.log(`  conf:  ${e.confidence}`);
    console.log(`  evidence: ${e.evidence.map((q) => JSON.stringify(q)).join(' | ') || '-'}\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

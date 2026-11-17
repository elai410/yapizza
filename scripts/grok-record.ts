// Usage: pnpm grok:record            record every demo input (needs ANTHROPIC_API_KEY)
//        pnpm grok:record --check    no key needed: replay each input and report which ones would hit
// Runs every demo input through Grok in record mode so replay answers them offline.
// Dedup 'match' calls are not recorded here: they get recorded when the demo flow runs through ingest in record mode.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { RawEmail } from '@/lib/contracts';

const CHECK = process.argv.includes('--check');
process.env.GROK_MODE = CHECK ? 'replay' : 'record';

async function main() {
  if (!CHECK && !process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set; nothing recorded');
    process.exit(1);
  }
  // Imported after GROK_MODE is set: the grok module reads env at load.
  const { extractEvents, rawEmailToInput } = await import('@/lib/pipeline/extract');
  const { readFile } = await import('@/lib/pipeline/files');
  const { grokMode } = await import('@/lib/grok');
  if (!CHECK && grokMode() !== 'record') {
    console.error(`grok mode is ${grokMode()} (YAPIZZA_FORCE_SIM=1?); nothing recorded`);
    process.exit(1);
  }

  const root = process.cwd();
  const jsonIn = (dir: string) =>
    existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(dir, f)) : [];

  const jobs: { name: string; run: () => Promise<{ mode: string; events: number } | null> }[] = [];
  for (const file of [...jsonIn(path.join(root, 'fixtures/emails')), ...jsonIn(path.join(root, 'fixtures/emails/real'))]) {
    jobs.push({
      name: path.relative(root, file),
      run: async () => {
        const r = await extractEvents(rawEmailToInput(JSON.parse(readFileSync(file, 'utf8')) as RawEmail));
        return { mode: r.mode, events: r.events.length };
      },
    });
  }
  const flyerDir = path.join(root, 'fixtures/flyers');
  for (const f of existsSync(flyerDir) ? readdirSync(flyerDir).filter((f) => !f.startsWith('.')).sort() : []) {
    jobs.push({
      name: `fixtures/flyers/${f}`,
      run: async () => {
        // Same shape the /demo upload sends: filename, no hostName.
        const read = await readFile({ filename: f, mimeType: '', data: readFileSync(path.join(flyerDir, f)) }, null);
        if (read.kind !== 'input') return null; // ICS: parsed without Grok
        const r = await extractEvents(read.input);
        return { mode: r.mode, events: r.events.length };
      },
    });
  }

  let written = 0;
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      const t0 = Date.now();
      try {
        const r = await job.run();
        if (!r) console.log(`${job.name}  skipped (no Grok call)`);
        else {
          if (r.mode === (CHECK ? 'replay' : 'grok')) written++;
          console.log(`${job.name}  mode=${r.mode}  events=${r.events}  ms=${Date.now() - t0}`);
        }
      } catch (err) {
        console.log(`${job.name}  FAILED  ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  console.log(CHECK ? `\n${written} of ${jobs.length} inputs replay offline today` : `\n${written} of ${jobs.length} inputs recorded to fixtures/grok-replay`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

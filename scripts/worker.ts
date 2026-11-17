// pnpm worker: polls the MailSource adapter and runs each new email through the pipeline.
import { adapters } from '@/lib/adapters';
import { ingestEmail } from '@/lib/pipeline/ingest';

const INTERVAL_MS = 5000;

async function tick() {
  const mail = adapters.mail();
  let emails;
  try {
    emails = await mail.pull();
  } catch (err) {
    console.error('[worker] pull failed:', err instanceof Error ? err.message : err);
    return;
  }
  for (const email of emails) {
    try {
      await ingestEmail(email);
    } catch (err) {
      console.error(`[worker] ingest failed for ${email.messageId}:`, err instanceof Error ? err.message : err);
    }
  }
}

async function main() {
  const s = adapters.status();
  console.log(`[worker] mail=${s.gmail} grok=${s.grok} forcedSim=${s.forcedSim}, polling every ${INTERVAL_MS / 1000}s`);
  for (;;) {
    await tick();
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main();

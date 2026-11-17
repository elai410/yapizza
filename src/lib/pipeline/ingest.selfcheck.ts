// pnpm tsx --env-file=.env src/lib/pipeline/ingest.selfcheck.ts  (writes one Source + events to dev.db)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { RawEmail } from '@/lib/contracts';
import { ingestEmail } from './ingest';

async function main() {
  const email = JSON.parse(readFileSync('fixtures/emails/01-silliman-ga-goat-yoga.json', 'utf8')) as RawEmail;
  email.messageId = `<selfcheck-${Date.now()}-${Math.random().toString(36).slice(2)}@yapizza.test>`;

  const r = await ingestEmail(email, 'demo');
  assert.ok(r.sourceId, "expected a source row"); // fixture 01 is seeded, so dedup may return it as same (0 created)
  console.log('first:', r.sourceId, r.created.map((e) => `${e.title} @ ${e.start} [${e.status}]`));

  const again = await ingestEmail(email, 'demo');
  assert.equal(again.sourceId, r.sourceId, 'same messageId must hit the same source');
  assert.equal(again.created.length, 0, 'second ingest of the same messageId must create nothing');
  console.log('ok: idempotent on messageId. sourceId to clean:', r.sourceId);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

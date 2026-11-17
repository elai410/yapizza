// Run: pnpm tsx --env-file=.env src/lib/grok/selfcheck.ts
import assert from 'node:assert/strict';
import { z } from 'zod';
import { grokMode, grokJson, replayKey, GrokReplayMiss, GROK_MODEL } from './index';

async function main() {
  delete process.env.XAI_API_KEY;
  delete process.env.GROK_MODE;
  assert.equal(grokMode(), 'replay');
  process.env.GROK_MODE = 'live';
  assert.equal(grokMode(), 'replay', 'live without key falls back to replay');
  process.env.XAI_API_KEY = 'x';
  process.env.YAPIZZA_FORCE_SIM = '1';
  assert.equal(grokMode(), 'replay', 'force sim wins');
  delete process.env.YAPIZZA_FORCE_SIM;
  assert.equal(grokMode(), 'live');
  delete process.env.XAI_API_KEY;
  delete process.env.GROK_MODE;

  const a = replayKey(GROK_MODEL, 'v1', { x: 1 });
  assert.equal(a, replayKey(GROK_MODEL, 'v1', { x: 1 }));
  assert.notEqual(a, replayKey(GROK_MODEL, 'v2', { x: 1 }));
  assert.match(a, /^[0-9a-f]{64}$/);

  await assert.rejects(
    grokJson({ name: 'selfcheck', promptVersion: 'selfcheck-v0', schema: z.object({ ok: z.boolean() }), system: 's', user: `nonce ${Date.now()}` }),
    GrokReplayMiss,
  );
  console.log('grok selfcheck ok');
}

main();

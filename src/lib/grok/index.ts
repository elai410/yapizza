// LLM client for the pipeline. Module and export names still say "grok" so callers
// (extract, dedup, digest, series) don't change; the calls go to the Claude API.
import Anthropic from '@anthropic-ai/sdk';
import { transformJSONSchema } from '@anthropic-ai/sdk/lib/transform-json-schema';
import type OpenAI from 'openai';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GrokMode } from '@/lib/contracts';

export type { GrokMode };

// Haiku by default: a card in seconds on stage, at low cost. CLAUDE_MODEL overrides.
export const GROK_MODEL: string = process.env.CLAUDE_MODEL || 'claude-haiku-5-5';
// Haiku has no server-side refusal fallback (the param 400s or does nothing); a refusal there drops to the rules.
const SERVER_FALLBACK = !GROK_MODEL.startsWith('claude-haiku');

export function grokMode(): GrokMode {
  if (process.env.YAPIZZA_FORCE_SIM === '1') return 'replay';
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const env = (process.env.GROK_MODE ?? '').trim();
  if (env === 'replay') return 'replay';
  if (env === 'live' || env === 'record') return hasKey ? env : 'replay';
  return hasKey ? 'live' : 'replay';
}

let client: Anthropic | null | undefined;
// null without a key or under YAPIZZA_FORCE_SIM=1: callers take their offline path.
export function llmClient(): Anthropic | null {
  if (process.env.YAPIZZA_FORCE_SIM === '1') return null;
  if (client === undefined) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    client = apiKey ? new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 }) : null;
  }
  return client;
}

// Deprecated: the xAI client is gone. Kept so api's Ask typechecks and falls back to keyword search until it moves to llmClient().
export function grokClient(): OpenAI | null {
  return null;
}

export class GrokReplayMiss extends Error {
  constructor(public key: string, name: string) {
    super(`replay miss: ${name} ${key}`);
    this.name = 'GrokReplayMiss';
  }
}

export type GrokContent = string | Anthropic.Beta.BetaContentBlockParam[];

export function replayKey(model: string, promptVersion: string, input: unknown): string {
  return createHash('sha256').update(JSON.stringify([model, promptVersion, input])).digest('hex');
}

function replayPath(key: string): string {
  return path.join(process.cwd(), 'fixtures', 'grok-replay', `${key}.json`);
}

export async function grokJson<T>(opts: {
  name: string;
  promptVersion: string;
  schema: z.ZodType<T>;
  system: string;
  user: GrokContent;
  reasoningEffort?: 'low' | 'medium' | 'high';
}): Promise<{ data: T; mode: GrokMode; ms: number }> {
  const t0 = Date.now();
  const mode = grokMode();
  const key = replayKey(GROK_MODEL, opts.promptVersion, { system: opts.system, user: opts.user, name: opts.name });

  if (mode === 'replay') {
    let raw: string;
    try {
      raw = await readFile(replayPath(key), 'utf8');
    } catch {
      throw new GrokReplayMiss(key, opts.name);
    }
    const file = JSON.parse(raw) as { response: unknown };
    return { data: opts.schema.parse(file.response), mode, ms: Date.now() - t0 };
  }

  const anthropic = llmClient();
  if (!anthropic) throw new GrokReplayMiss(key, opts.name); // unreachable: grokMode() returns replay without a key

  // The SDK's transform drops what structured outputs rejects (e.g. confidence's minimum/maximum); zod still validates the reply.
  const schema = transformJSONSchema(z.toJSONSchema(opts.schema) as Record<string, unknown>);
  const message = await anthropic.beta.messages.create({
    model: GROK_MODEL,
    max_tokens: 16000,
    system: opts.system,
    messages: [{ role: 'user', content: opts.user }],
    output_config: { format: { type: 'json_schema', schema }, effort: opts.reasoningEffort ?? 'low' },
    // A safety decline is re-run server-side on a fallback model instead of failing the ingest (not on Haiku).
    ...(SERVER_FALLBACK ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    // thinking stays unset (adaptive); it counts toward max_tokens, hence the 16000 room.
  });

  // Check why it stopped before reading content: a refusal or a cut-off has no usable JSON.
  if (message.stop_reason === 'refusal') throw new Error(`${opts.name}: refused (${message.stop_details?.category ?? 'no category'})`);
  if (message.stop_reason === 'max_tokens') throw new Error(`${opts.name}: hit max_tokens`);
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  if (!text) throw new Error(`${opts.name}: empty response (${message.stop_reason})`);
  const response: unknown = JSON.parse(text);
  const data = opts.schema.parse(response);

  // Live calls are saved too: a rehearsal with the key leaves every demo input (and dedup match) replayable offline.
  const file = replayPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    JSON.stringify(
      { model: GROK_MODEL, servedBy: message.model, promptVersion: opts.promptVersion, name: opts.name, createdAt: new Date().toISOString(), response },
      null,
      2,
    ),
  );

  const ms = Date.now() - t0;
  console.log(`[llm] ${opts.name} ${mode} ${message.model} ${ms}ms in=${message.usage.input_tokens} out=${message.usage.output_tokens}`);
  return { data, mode, ms };
}

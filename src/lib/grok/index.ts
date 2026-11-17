import OpenAI from 'openai';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { GrokMode } from '@/lib/contracts';

export type { GrokMode };

export const GROK_MODEL: string = process.env.GROK_MODEL || 'grok-4.7';

export function grokMode(): GrokMode {
  if (process.env.YAPIZZA_FORCE_SIM === '1') return 'replay';
  const hasKey = Boolean(process.env.XAI_API_KEY);
  const env = (process.env.GROK_MODE ?? '').trim();
  if (env === 'replay') return 'replay';
  if (env === 'live' || env === 'record') return hasKey ? env : 'replay';
  return hasKey ? 'live' : 'replay';
}

let client: OpenAI | null | undefined;
export function grokClient(): OpenAI | null {
  if (client === undefined) {
    const apiKey = process.env.XAI_API_KEY;
    client = apiKey
      ? new OpenAI({ apiKey, baseURL: 'https://api.x.ai/v1', timeout: 25_000, maxRetries: 1 })
      : null;
  }
  return client;
}

export class GrokReplayMiss extends Error {
  constructor(public key: string, name: string) {
    super(`grok replay miss: ${name} ${key}`);
    this.name = 'GrokReplayMiss';
  }
}

export type GrokContent = string | OpenAI.Chat.Completions.ChatCompletionContentPart[];

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

  const openai = grokClient();
  if (!openai) throw new GrokReplayMiss(key, opts.name); // unreachable: grokMode() returns replay without a key

  const { $schema: _drop, ...schema } = z.toJSONSchema(opts.schema) as Record<string, unknown>;
  const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
    model: GROK_MODEL,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
    response_format: { type: 'json_schema', json_schema: { name: opts.name, schema, strict: true } },
    reasoning_effort: opts.reasoningEffort ?? 'low',
  };

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await openai.chat.completions.create(body);
  } catch (err) {
    // Some xAI models reject reasoning_effort; retry once without it.
    if (err instanceof OpenAI.APIError && err.status === 400 && /reasoning/i.test(err.message)) {
      const { reasoning_effort: _r, ...rest } = body;
      completion = await openai.chat.completions.create(rest);
    } else {
      throw err;
    }
  }

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error(`grok ${opts.name}: empty response`);
  const response: unknown = JSON.parse(content);
  const data = opts.schema.parse(response);

  if (mode === 'record') {
    const file = replayPath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(
      file,
      JSON.stringify(
        { model: GROK_MODEL, promptVersion: opts.promptVersion, name: opts.name, createdAt: new Date().toISOString(), response },
        null,
        2,
      ),
    );
  }

  const ms = Date.now() - t0;
  console.log(`[grok] ${opts.name} ${mode} ${ms}ms`);
  return { data, mode, ms };
}

// Ask Yapizza through Claude tool use (CLAUDE.md 12.5, now on the Anthropic Messages API).
// Callers fall back to keywordAsk on any throw. AskResponse.mode stays 'grok', which now means "the model".
import Anthropic from '@anthropic-ai/sdk';
import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';
import { TAGS, type AskResponse } from '@/lib/contracts';
import { getCards } from '@/lib/db';
import { llmClient } from '@/lib/grok';
import { GLOSSARY } from '@/lib/yale';
import { toolGetEvent, toolSearchEvents, toolSearchHosts } from './index';

const MAX_TOOL_ROUNDS = 3;
// Haiku keeps Ask well under the route deadline; CLAUDE_MODEL (shared with pipeline) overrides it.
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-5-5';
// Haiku has no server-side refusal fallback (sending one is a 400); larger models get it.
const FALLBACK = MODEL.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

// Tool inputs are validated again here: strict schemas guarantee shape, zod guards the code that runs.
const searchEventsArgs = z.object({
  keywords: z.string().nullish(),
  tags: z.array(z.enum(TAGS)).nullish(),
  dateFrom: z.string().nullish(),
  dateTo: z.string().nullish(),
  college: z.string().nullish(),
  freeFood: z.boolean().nullish(),
});
const searchHostsArgs = z.object({ keywords: z.string() });
const getEventArgs = z.object({ id: z.string() });

const answerSchema = z.object({
  answer: z.string(),
  results: z.array(z.object({ id: z.string(), why: z.string() })),
});

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: 'search_events',
    description:
      'Search upcoming Yale events. All filters optional. Dates are ISO 8601 with offset, America/New_York. Returns up to 15 compact events with ids.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        keywords: { type: 'string', description: 'Words to match in title, host, place, food and summary.' },
        tags: { type: 'array', items: { type: 'string', enum: [...TAGS] } },
        dateFrom: { type: 'string', description: 'Start of the window, ISO 8601.' },
        dateTo: { type: 'string', description: 'End of the window, ISO 8601.' },
        college: { type: 'string', description: 'Residential college full name, e.g. "Jonathan Edwards".' },
        freeFood: { type: 'boolean', description: 'Only events with free food.' },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'search_hosts',
    description: 'Find clubs, colleges, and offices by name, each with its upcoming events.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { keywords: { type: 'string' } },
      required: ['keywords'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_event',
    description: 'Full details for one event id returned by search_events or search_hosts.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
      additionalProperties: false,
    },
  },
];

const ANSWER_FORMAT = {
  type: 'json_schema' as const,
  schema: {
    type: 'object',
    properties: {
      answer: { type: 'string' },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, why: { type: 'string' } },
          required: ['id', 'why'],
          additionalProperties: false,
        },
      },
    },
    required: ['answer', 'results'],
    additionalProperties: false,
  },
};

async function runTool(name: string, input: unknown): Promise<unknown> {
  const strip = <T extends Record<string, unknown>>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as { [K in keyof T]?: NonNullable<T[K]> };
  if (name === 'search_events') return toolSearchEvents(strip(searchEventsArgs.parse(input)));
  if (name === 'search_hosts') return toolSearchHosts(searchHostsArgs.parse(input));
  if (name === 'get_event') return toolGetEvent(getEventArgs.parse(input));
  throw new Error(`unknown tool ${name}`);
}

// The model that actually answered: a fallback model when the default one declined.
const res_model = (m: Anthropic.Beta.BetaMessage) => m.model;

function system(now: Date): string {
  return `You answer Yale students' questions about campus events. Use the tools to find events; never invent events or ids.
Current time in New Haven: ${formatInTimeZone(now, 'America/New_York', 'EEEE, yyyy-MM-dd HH:mm xxx')}.
"Tonight" means from now until midnight. Only include events that have not ended.
Tags: ${TAGS.join(', ')}. Free food is the freeFood filter, not a keyword.
${GLOSSARY}
Reply with JSON only. "answer" is at most 2 short sentences in plain words about the events, never about your searches or tools; no exclamation marks, no em dashes, no emoji.
"results" lists up to 8 event ids from tool results that match the question, most relevant first, and leaves out events that don't.
If nothing matches exactly, say so in "answer" and list up to 3 of the closest upcoming events (for example the next free food), so the student has something to open.
Each "why" is 12 words or fewer and says what matched (topic, host, free food), never what an event lacks. The card already shows date, time and place, so don't repeat them.`;
}

export async function grokAsk(q: string, now = new Date()): Promise<AskResponse> {
  const anthropic = llmClient(); // null without ANTHROPIC_API_KEY or under YAPIZZA_FORCE_SIM
  if (!anthropic) throw new Error('grok unavailable');
  const t0 = Date.now();

  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: q }];
  let final: Anthropic.Beta.BetaMessage | null = null;
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const res = await anthropic.beta.messages.create({
      model: MODEL,
      ...FALLBACK, // a safety decline re-runs on a fallback model inside the same call
      max_tokens: 8000, // thinking stays adaptive (unset) and shares this budget with the JSON answer
      system: system(now),
      tools: TOOLS,
      tool_choice: { type: 'auto' }, // forced tool_choice returns a 400 on Opus 5.5
      output_config: { effort: 'low', format: ANSWER_FORMAT },
      messages,
    });
    if (res.stop_reason === 'refusal') throw new Error(`ask refused: ${res.stop_details?.category ?? 'unknown'}`);
    if (res.stop_reason === 'max_tokens') throw new Error('ask hit max_tokens');
    if (res.stop_reason !== 'tool_use') {
      final = res;
      break;
    }
    if (round === MAX_TOOL_ROUNDS) throw new Error(`ask still calling tools after ${MAX_TOOL_ROUNDS} rounds`);

    messages.push({ role: 'assistant', content: res.content });
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    // All results go back in one user message; a failed tool is reported, not dropped.
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(
      calls.map(async (call) => {
        try {
          return { type: 'tool_result' as const, tool_use_id: call.id, content: JSON.stringify(await runTool(call.name, call.input)) };
        } catch (err) {
          return { type: 'tool_result' as const, tool_use_id: call.id, content: err instanceof Error ? err.message : 'tool failed', is_error: true };
        }
      }),
    );
    messages.push({ role: 'user', content: results });
  }
  if (!final) throw new Error('ask: no final message');

  const text = final.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const parsed = answerSchema.parse(JSON.parse(text));

  // Cards come from the database by id only; ids the model made up are dropped.
  const whyById = new Map(parsed.results.map((r) => [r.id, r.why.split(/\s+/).slice(0, 12).join(' ')]));
  const cards = await getCards([...whyById.keys()].slice(0, 8));
  console.log(`[ask] ${res_model(final)} ${Date.now() - t0}ms`);
  return {
    answer: parsed.answer,
    results: cards.map((event) => ({ event, why: whyById.get(event.id) ?? '' })),
    mode: 'grok',
  };
}

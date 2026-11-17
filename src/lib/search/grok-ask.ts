// Ask Yapizza through Grok tool calling (CLAUDE.md 12.5). Callers fall back to keywordAsk on any throw.
import OpenAI from 'openai';
import { formatInTimeZone } from 'date-fns-tz';
import { z } from 'zod';
import { TAGS, type AskResponse } from '@/lib/contracts';
import { getCards } from '@/lib/db';
import { GROK_MODEL, grokClient, grokMode } from '@/lib/grok';
import { GLOSSARY } from '@/lib/yale';
import { toolGetEvent, toolSearchEvents, toolSearchHosts } from './index';

type Msg = OpenAI.Chat.Completions.ChatCompletionMessageParam;
type Params = OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;

const MAX_TOOL_ROUNDS = 3;

const searchEventsArgs = z.object({
  keywords: z.string().optional(),
  tags: z.array(z.enum(TAGS)).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  college: z.string().optional(),
  freeFood: z.boolean().optional(),
});
const searchHostsArgs = z.object({ keywords: z.string() });
const getEventArgs = z.object({ id: z.string() });

const answerSchema = z.object({
  answer: z.string(),
  results: z.array(z.object({ id: z.string(), why: z.string() })),
});

function tool(name: string, description: string, schema: z.ZodType): OpenAI.Chat.Completions.ChatCompletionTool {
  const { $schema: _drop, ...parameters } = z.toJSONSchema(schema) as Record<string, unknown>;
  return { type: 'function', function: { name, description, parameters } };
}

const TOOLS = [
  tool('search_events', 'Search upcoming Yale events. Dates are ISO 8601 with offset. All arguments optional.', searchEventsArgs),
  tool('search_hosts', 'Find clubs, colleges, and offices by name, with their upcoming events.', searchHostsArgs),
  tool('get_event', 'Full details for one event id returned by search_events or search_hosts.', getEventArgs),
];

async function runTool(name: string, rawArgs: string): Promise<unknown> {
  const args: unknown = JSON.parse(rawArgs || '{}');
  if (name === 'search_events') return toolSearchEvents(searchEventsArgs.parse(args));
  if (name === 'search_hosts') return toolSearchHosts(searchHostsArgs.parse(args));
  if (name === 'get_event') return toolGetEvent(getEventArgs.parse(args));
  return { error: `unknown tool ${name}` };
}

async function create(openai: OpenAI, body: Params) {
  try {
    return await openai.chat.completions.create(body);
  } catch (err) {
    // Some xAI models reject reasoning_effort; retry once without it.
    if (err instanceof OpenAI.APIError && err.status === 400 && /reasoning/i.test(err.message)) {
      const { reasoning_effort: _r, ...rest } = body;
      return openai.chat.completions.create(rest);
    }
    throw err;
  }
}

function system(now: Date): string {
  return `You answer Yale students' questions about campus events. Use the tools to find events; never invent events or ids.
Current time in New Haven: ${formatInTimeZone(now, 'America/New_York', "EEEE, yyyy-MM-dd HH:mm xxx")}.
"Tonight" means from now until midnight. Only include events that have not ended.
Tags: ${TAGS.join(', ')}. Free food is the freeFood flag, not a keyword.
${GLOSSARY}
Final answer: at most 2 short sentences, plain words, no exclamation marks, no em dashes, no emoji. For each result, a "why" of 12 words or fewer. Order results by relevance, at most 8.`;
}

export async function grokAsk(q: string, now = new Date()): Promise<AskResponse> {
  const openai = grokClient();
  // shortcut: ask has no replay recording; replay mode (no key or forced sim) uses the keyword fallback.
  if (!openai || grokMode() === 'replay') throw new Error('grok unavailable');
  const t0 = Date.now();

  const messages: Msg[] = [
    { role: 'system', content: system(now) },
    { role: 'user', content: q },
  ];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await create(openai, { model: GROK_MODEL, messages, tools: TOOLS, tool_choice: 'auto', reasoning_effort: 'low' });
    const msg = res.choices[0]?.message;
    const calls = (msg?.tool_calls ?? []).filter((c) => c.type === 'function');
    if (!msg || !calls.length) break;
    messages.push(msg);
    for (const call of calls) {
      let out: unknown;
      try {
        out = await runTool(call.function.name, call.function.arguments);
      } catch (err) {
        out = { error: err instanceof Error ? err.message : 'tool failed' };
      }
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(out) });
    }
  }

  const { $schema: _drop, ...schema } = z.toJSONSchema(answerSchema) as Record<string, unknown>;
  const final = await create(openai, {
    model: GROK_MODEL,
    messages,
    tools: TOOLS,
    tool_choice: 'none',
    response_format: { type: 'json_schema', json_schema: { name: 'ask_answer', schema, strict: true } },
    reasoning_effort: 'low',
  });
  const content = final.choices[0]?.message?.content;
  if (!content) throw new Error('grok ask: empty response');
  const parsed = answerSchema.parse(JSON.parse(content));

  // Cards come from the database by id only; ids Grok made up are dropped.
  const whyById = new Map(parsed.results.map((r) => [r.id, r.why.split(/\s+/).slice(0, 12).join(' ')]));
  const cards = await getCards([...whyById.keys()].slice(0, 8));
  console.log(`[grok] ask live ${Date.now() - t0}ms`);
  return {
    answer: parsed.answer,
    results: cards.map((event) => ({ event, why: whyById.get(event.id) ?? '' })),
    mode: 'grok',
  };
}

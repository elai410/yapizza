// Owner: api. Loads fixtures/events.seed.json through the same write path the pipeline uses.
// Dates are stored exactly as written in the file; never shifted.
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { TAGS } from '../src/lib/contracts';
import { prisma, saveExtraction } from '../src/lib/db';

const SEED_FILE = process.env.SEED_FILE ?? 'fixtures/events.seed.json';

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'not a valid date');

const Item = z.object({
  kind: z.enum(['event', 'listing']).default('event'),
  title: z.string().min(1),
  start: isoDate.nullish().transform((v) => v ?? null),
  end: isoDate.nullish().transform((v) => v ?? null),
  allDay: z.boolean().default(false),
  locationRaw: z.string().nullish().transform((v) => v ?? null),
  placeId: z.string().nullish().transform((v) => v ?? null),
  hostName: z.string().nullish().transform((v) => v ?? null),
  summary: z.string().default(''),
  tags: z.array(z.enum(TAGS)).default([]),
  freeFood: z.boolean().default(false),
  food: z.string().nullish().transform((v) => v ?? null),
  audience: z.enum(['open_to_all', 'members_only', 'college_only']).default('open_to_all'),
  college: z.string().nullish().transform((v) => v ?? null),
  rsvpUrl: z.string().nullish().transform((v) => v ?? null),
  price: z.string().nullish().transform((v) => v ?? null),
  evidence: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(1),
  rawText: z.string().optional(),
});

async function main() {
  if (!existsSync(SEED_FILE)) {
    console.log(`seed: ${SEED_FILE} not found, skipping`);
    return;
  }
  const data: unknown = JSON.parse(readFileSync(SEED_FILE, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`seed: ${SEED_FILE} must be a JSON array`);

  let events = 0;
  let listings = 0;
  let skipped = 0;
  for (const [i, raw] of data.entries()) {
    const parsed = Item.safeParse(raw);
    if (!parsed.success) {
      console.warn(`seed: skip #${i}: ${parsed.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`);
      skipped++;
      continue;
    }
    const { rawText, ...ev } = parsed.data;
    if (ev.kind === 'event' && !ev.start) {
      console.warn(`seed: skip #${i}: no start`);
      skipped++;
      continue;
    }
    const res = await saveExtraction(
      { kind: 'form', listName: 'events.real.md', subject: ev.title, rawText: rawText ?? ev.title, messageId: `seed-${i}` },
      { events: [ev], flagged: false, flagReason: null },
    );
    if (res.duplicateSource) skipped++;
    events += res.created.length;
    listings += res.listings;
  }
  console.log(`seed: ${events} events, ${listings} listings, ${skipped} skipped`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

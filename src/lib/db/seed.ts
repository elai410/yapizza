// Seed loader and demo reset. Loads fixtures/events.seed.json through the same write path the pipeline uses.
// Dates are stored exactly as written in the file; never shifted.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { TAGS } from '@/lib/contracts';
import { prisma, saveExtraction } from '.';

export const SEED_FILE = process.env.SEED_FILE ?? path.join(process.cwd(), 'fixtures', 'events.seed.json');

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

export interface SeedResult {
  events: number;
  listings: number;
  skipped: number;
}

export async function seedFromFile(file = SEED_FILE): Promise<SeedResult> {
  const out: SeedResult = { events: 0, listings: 0, skipped: 0 };
  if (!existsSync(file)) {
    console.log(`seed: ${file} not found, skipping`);
    return out;
  }
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`seed: ${file} must be a JSON array`);

  for (const [i, raw] of data.entries()) {
    const parsed = Item.safeParse(raw);
    if (!parsed.success) {
      console.warn(`seed: skip #${i}: ${parsed.error.issues.map((x) => `${x.path.join('.')} ${x.message}`).join('; ')}`);
      out.skipped++;
      continue;
    }
    const { rawText, ...ev } = parsed.data;
    if (ev.kind === 'event' && !ev.start) {
      console.warn(`seed: skip #${i}: no start`);
      out.skipped++;
      continue;
    }
    const res = await saveExtraction(
      { kind: 'form', listName: 'events.real.md', subject: ev.title, rawText: rawText ?? ev.title, messageId: `seed-${i}` },
      { events: [ev], flagged: false, flagReason: null },
    );
    if (res.duplicateSource) out.skipped++;
    out.events += res.created.length;
    out.listings += res.listings;
  }
  return out;
}

/**
 * Demo panel reset: drops every event, source, and the rows hanging off them, then reloads the seed.
 * Hosts and users stay (seed upserts hosts by name); host claims are cleared so the host beat starts fresh.
 */
export async function resetDemoData(): Promise<SeedResult & { ms: number }> {
  const t0 = Date.now();
  await prisma.$transaction([
    prisma.save.deleteMany(),
    prisma.eventVersion.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.listing.deleteMany(),
    prisma.event.deleteMany(),
    prisma.source.deleteMany(),
    prisma.series.deleteMany(), // rebuilt from the new events on the next /api/traditions read
    prisma.host.updateMany({ data: { officerNetid: null } }),
  ]);
  const res = await seedFromFile();
  return { ...res, ms: Date.now() - t0 };
}

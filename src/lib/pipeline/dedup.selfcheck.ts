// pnpm tsx --env-file=.env src/lib/pipeline/dedup.selfcheck.ts
// Runs on a temp copy of prisma/dev.db, so the demo data is never touched.
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { RawEmail } from '@/lib/contracts';

const dir = mkdtempSync(path.join(tmpdir(), 'yapizza-dedup-'));
copyFileSync('prisma/dev.db', path.join(dir, 'dev.db'));
process.env.DATABASE_URL = `file:${path.join(dir, 'dev.db')}`;

function fixture(name: string): RawEmail {
  const e = JSON.parse(readFileSync(`fixtures/emails/${name}.json`, 'utf8')) as RawEmail;
  e.messageId = `<dedup-${name}-${Math.random().toString(36).slice(2)}@yapizza.test>`;
  return e;
}

async function main() {
  // Imported after DATABASE_URL points at the copy.
  const { ingestEmail } = await import('./ingest');
  const { prisma } = await import('@/lib/db');
  const { titleSimilarity } = await import('./dedup');

  // Back to seed-only, like after demo:reset; earlier test ingests would otherwise be the match.
  const extra = { source: { NOT: { messageId: { startsWith: 'seed-' } } } };
  await prisma.eventVersion.deleteMany({ where: { event: extra } });
  await prisma.save.deleteMany({ where: { event: extra } });
  await prisma.event.deleteMany({ where: extra });
  await prisma.listing.deleteMany({ where: extra });
  await prisma.source.deleteMany({ where: { NOT: { messageId: { startsWith: 'seed-' } } } });

  assert.ok(titleSimilarity('ROOM CHANGE: Math Research Panel', 'MATH RESEARCH PANEL: thinking about REUs') >= 0.5);
  assert.equal(titleSimilarity('Pset night', 'Putnam problem session'), 0);

  // 1. Room change: 34 announces the panel in WLH 120, 39 moves it to LC 102.
  await ingestEmail(fixture('34-yums-weekly-nov-16'), 'demo');
  const room = await ingestEmail(fixture('39-yums-panel-room-change'), 'demo');
  console.log('39:', room.created.length, 'created;', room.updated.map((e) => `${e.title} @ ${e.placeName} [${e.updatedFields}]`));
  assert.equal(room.created.length, 0, 'room change must not create a card');
  assert.equal(room.updated.length, 1, 'room change must update one card');
  assert.ok(room.updated[0].updatedFields.some((f) => f === 'placeId' || f === 'locationRaw'));
  const moved = await prisma.event.findUniqueOrThrow({ where: { id: room.updated[0].id } });
  assert.equal(moved.locationRaw, 'LC 102');
  assert.equal(await prisma.eventVersion.count({ where: { eventId: moved.id, fromSourceId: room.sourceId } }), 1);

  // 2. Same event on two lists: 22 adds nothing after 21.
  await ingestEmail(fixture('21-aasa-night-market-aacc'), 'demo');
  const twice = await ingestEmail(fixture('22-aasa-night-market-dwight'), 'demo');
  console.log('22:', twice.created.map((e) => e.title), 'created;', twice.updated.length, 'updated');
  assert.equal(twice.created.filter((e) => /night market|dwight/i.test(e.title)).length, 0, 'second list must not duplicate the night market');
  assert.ok(await prisma.source.findUnique({ where: { id: twice.sourceId } }), 'the second email is still saved as a source');

  // 3. Cancellation: 33 lists Politics of the Purse, 40 cancels it.
  await ingestEmail(fixture('33-aacc-newsletter-nov-16'), 'demo');
  const cancel = await ingestEmail(fixture('40-aacc-politics-purse-canceled'), 'demo');
  console.log('40:', cancel.created.length, 'created;', cancel.updated.map((e) => `${e.title} [${e.status}] [${e.updatedFields}]`));
  assert.equal(cancel.created.length, 0);
  assert.equal(cancel.updated.length, 1);
  assert.equal(cancel.updated[0].status, 'canceled');
  assert.deepEqual(cancel.updated[0].updatedFields, ['status']);

  console.log('ok: room change, two lists, cancellation');
  await prisma.$disconnect();
}

main()
  .then(() => {
    rmSync(dir, { recursive: true, force: true });
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    rmSync(dir, { recursive: true, force: true });
    process.exit(1);
  });

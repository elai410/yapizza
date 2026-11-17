// Run: pnpm tsx --env-file=.env src/lib/pipeline/digest.selfcheck.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { EventCard, RawEmail } from '@/lib/contracts';
import { fallbackExtract } from './fallback';
import { writeDigest } from './digest';
import { detectSeries, isTraditionTitle, normalizeTitle } from './series';

const FILES = [
  '01-silliman-ga-goat-yoga.json', '02-ycc-block-party.json', '10-yasss-stargazing-oct-29.json',
  '20-yums-pizza-weil.json', '26-yasss-stargazing-nov-10.json', '32-ycc-harvard-yale-weekend.json',
];

const cards: EventCard[] = FILES.flatMap((file) => {
  const e = JSON.parse(readFileSync(path.join(process.cwd(), 'fixtures/emails', file), 'utf8')) as RawEmail;
  const r = fallbackExtract({ text: e.text, subject: e.subject, from: e.from, listName: e.listName, sentAt: e.sentAt });
  return r.events
    .filter((x) => x.kind === 'event' && x.start)
    .map((x, i) => ({
      id: `${file.slice(0, 2)}-${i}`,
      title: x.title,
      start: x.start!,
      end: x.end,
      allDay: x.allDay,
      placeId: x.placeId,
      placeName: x.locationRaw,
      hostName: x.hostName,
      tags: x.tags,
      freeFood: x.freeFood,
      food: x.food,
      audience: x.audience,
      college: x.college,
      status: 'live' as const,
      updatedFields: [],
      createdAt: e.sentAt,
    }));
});
assert.ok(cards.length >= 10, `expected ~10 cards, got ${cards.length}`);

async function main() {
  const d = await writeDigest(cards, { userName: 'Demo Student', college: 'Silliman', now: new Date('2026-11-15T12:00:00-05:00') });
  const ids = new Set(cards.map((c) => c.id));
  assert.ok(d.eventIds.length > 0 && d.eventIds.length <= 8);
  assert.ok(d.eventIds.every((id) => ids.has(id)));
  assert.ok(!d.html.includes('!'), 'no "!" in html');
  assert.ok(!d.html.includes('—') && !d.text.includes('—') && !d.text.includes('!'));
  if (!process.env.XAI_API_KEY) {
    assert.equal(d.mode, 'fallback');
    assert.equal(d.subject, `This week at Yale: ${d.eventIds.length} events`);
    assert.match(d.text, /\d{1,2}:\d{2} [AP]M · /);
  }

  // Canceled events never make the digest; empty input still renders.
  const canceled = await writeDigest([{ ...cards[0], status: 'canceled' }]);
  assert.deepEqual(canceled.eventIds, []);

  assert.equal(normalizeTitle('Stargazing #3, Nov 10'), 'stargazing');
  assert.ok(isTraditionTitle('The Game') && !isTraditionTitle('Game Night') && !isTraditionTitle('Silliman College Tea'));

  const series = await detectSeries(cards.map((c) => ({ id: c.id, title: c.title, start: c.start, hostName: c.hostName })));
  const star = series.find((s) => /stargazing/i.test(s.title));
  assert.ok(star, 'Stargazing series found');
  assert.equal(star.eventIds.length, 2);
  assert.deepEqual(star.yearsSeen, [2026]);
  const game = series.find((s) => /the game/i.test(s.title));
  assert.ok(game?.isTradition, 'The Game is a tradition');
  assert.ok(!series.some((s) => /block party/i.test(s.title) && s.isTradition));

  console.log(`digest ${d.mode}: ${d.eventIds.length} picks, "${d.subject}"; series: ${series.map((s) => `${s.title}(${s.eventIds.length}${s.isTradition ? ',T' : ''})`).join(', ')}`);
  console.log('digest selfcheck ok');
}

main().catch((err) => { console.error(err); process.exit(1); });

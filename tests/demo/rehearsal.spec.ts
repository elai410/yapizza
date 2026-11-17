// Demo rehearsal: walks the 3-minute story in docs/DEMO.md, CP1 through CP4, the way the presenter runs it,
// with tab 1 on the feed and tab 2 on /demo, and prints a timing table with each beat against its budget.
//
// Needs a fresh DB, so it calls POST /api/demo/reset (the /demo Reset button) before the first beat and
// again at the end, leaving the seed clean for the real demo.
//
//   pnpm exec playwright test tests/demo/rehearsal.spec.ts
//
// Not part of `pnpm test:smoke`. Timing budgets are soft (reported, never stop the run); correctness is hard.
import { test, expect, type Locator, type Page } from '@playwright/test';
import type { AskResponse, IngestResult, IntegrationStatus } from '../../src/lib/contracts/types';
import { gotoApp } from '../smoke/helpers';

test.describe.configure({ mode: 'serial' });

const cards = (page: Page | Locator) => page.getByTestId('event-card');
const isPost = (path: string) => (r: { url(): string; request(): { method(): string } }) =>
  new URL(r.url()).pathname === path && r.request().method() === 'POST';
// Waits on correctness are long so a slow beat still finishes and shows up in the table as over budget.
const WAIT = 30_000;

test('rehearsal: the 3-minute story, CP1 to CP4', async ({ context }) => {
  test.setTimeout(300_000);
  const reset = async () => expect((await context.request.post('/api/demo/reset', { data: {} })).status()).toBe(200);
  await reset();
  const timings: { beat: string; ms: number; budget: number }[] = [];

  async function beat(name: string, budget: number, fn: () => Promise<void>) {
    await test.step(name, async () => {
      const t0 = Date.now();
      await fn();
      const ms = Date.now() - t0;
      timings.push({ beat: name, ms, budget });
      expect.soft(ms, `${name}: ${ms} ms, budget ${budget} ms`).toBeLessThanOrEqual(budget);
    });
  }

  const feed = await context.newPage(); // tab 1
  const demo = await context.newPage(); // tab 2
  const status = (await (await feed.request.get('/api/integrations/status')).json()) as IntegrationStatus;
  console.log(`integrations: ${JSON.stringify(status)}`);

  // Presses a /demo hotkey on tab 2, then switches to tab 1, as the presenter does.
  async function press(key: string, path: string) {
    await demo.bringToFront();
    const res = demo.waitForResponse(isPost(path), { timeout: WAIT });
    await demo.keyboard.press(key);
    await feed.bringToFront();
    return res;
  }

  // Waits until tab 1 shows more cards matching `re` than `before`; the feed polls, so no reload.
  async function expectNewCard(re: RegExp, before: number) {
    await expect.poll(() => cards(feed).filter({ hasText: re }).count(), { timeout: WAIT }).toBeGreaterThan(before);
  }

  let pizzaLive = false;
  let drawerId: string | null = null;

  try {
    await beat('CP0 open tabs', 15_000, async () => {
      await gotoApp(feed, '/');
      await expect(cards(feed).first()).toBeVisible({ timeout: WAIT });
      await gotoApp(demo, '/demo');
      await expect(demo.getByTestId('demo-status')).toBeVisible();
    });

    await beat('CP1 free food chip narrows', 5_000, async () => {
      await feed.bringToFront();
      const chip = feed.getByRole('button', { name: 'Free food', exact: true });
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'true');
      const foodCards = feed.getByRole('button', { name: /free food/i }).and(cards(feed));
      await expect
        .poll(async () => {
          if (await feed.getByTestId('empty-state').isVisible()) return true;
          const total = await cards(feed).count();
          return total > 0 && total === (await foodCards.count());
        }, { timeout: WAIT })
        .toBe(true);
      // Turn it back off: the CP2 cards are academic, not free food.
      await chip.click();
      await expect(chip).toHaveAttribute('aria-pressed', 'false');
    });

    await beat('CP1 open card, Add to calendar link', 5_000, async () => {
      await cards(feed).first().click();
      const dialog = feed.getByRole('dialog');
      await expect(dialog).toBeVisible();
      const href = await dialog.getByRole('link', { name: /add to calendar/i }).getAttribute('href', { timeout: WAIT });
      expect(href).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render/);
      expect(href).toContain('action=TEMPLATE');
      await feed.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });

    await beat('CP2 send YUMS email (key 1), card on tab 1', 10_000, async () => {
      const re = /pset night|putnam|research panel/i;
      const before = await cards(feed).filter({ hasText: re }).count();
      const res = press('1', '/api/demo/send-email');
      await expectNewCard(re, before);
      expect((await res).status()).toBe(200);
    });

    await beat('CP2 upload flyer (key 3), Langer on tab 1', 15_000, async () => {
      const before = await cards(feed).filter({ hasText: /langer/i }).count();
      const res = press('3', '/api/upload');
      await expectNewCard(/langer/i, before);
      expect((await res).status()).toBe(200);
    });

    await beat('CP3 room change (key 2), Updated badge', 10_000, async () => {
      const res = press('2', '/api/demo/room-change');
      const panel = cards(feed).filter({ hasText: /research panel/i });
      await expect(panel.first()).toContainText('Updated', { timeout: WAIT });
      expect((await res).status()).toBe(200);
      await expect(panel, 'room change made a duplicate card').toHaveCount(1);
    });

    await beat('CP3 free food now (key 4), Silliman Buttery on tab 1', 10_000, async () => {
      const res = await press('4', '/api/demo/free-food-now');
      expect(res.status()).toBe(200);
      const result = ((await res.json()) as { result?: IngestResult }).result;
      pizzaLive = !!result && [...result.created, ...result.updated].some((e) => e.status === 'live');
      if (pizzaLive) {
        await expect(cards(feed).filter({ hasText: /silliman buttery/i }).first()).toBeVisible({ timeout: WAIT });
      } else {
        // Documented replay behavior (DEMO.md CP3 fallbacks): rule-based extractor, confidence 0.50, review, hidden from the feed.
        expect.soft(pizzaLive, `free food now went to review (grok ${status.grok}); the beat falls back to Putnam`).toBe(true);
      }
    });

    await beat('CP3 ask "free food tonight"', 8_000, async () => {
      await gotoApp(feed, '/ask');
      const box = feed.getByLabel('Ask Yapizza');
      async function ask(q: string) {
        await box.fill(q);
        const res = feed.waitForResponse(isPost('/api/ask'), { timeout: WAIT });
        await box.press('Enter');
        return (await (await res).json()) as AskResponse;
      }
      let answer = await ask('free food tonight');
      if (answer.results.length === 0) {
        expect.soft(answer.results.length, '"free food tonight" returned nothing; asking "free food this week"').toBeGreaterThan(0);
        answer = await ask('free food this week');
      }
      console.log(`ask: mode ${answer.mode}, ${answer.results.length} results: ${answer.results.map((r) => r.event.title).join(' / ')}`);
      await expect(feed.getByTestId('ask-result').getByTestId('event-card').first()).toBeVisible({ timeout: WAIT });
    });

    await beat('CP3 "How this was read" drawer', 5_000, async () => {
      // The pizza card from the ask results; in replay, Putnam from the feed (DEMO.md CP3 fallbacks).
      let card = cards(feed.getByTestId('ask-result')).filter({ hasText: /silliman buttery|free pizza/i }).first();
      if (!pizzaLive || !(await card.isVisible())) {
        if (pizzaLive) expect.soft(false, 'pizza card not in ask results; opening Putnam instead').toBe(true);
        await gotoApp(feed, '/');
        card = cards(feed).filter({ hasText: /putnam/i }).first();
      }
      await expect(card).toBeVisible({ timeout: WAIT });
      drawerId = await card.getAttribute('data-event-id');
      await card.click();
      const dialog = feed.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: /how this was read/i }).click();
      await expect(dialog.locator('mark').first()).toBeVisible();
      await expect(dialog.getByText(/Read by Grok/)).toBeVisible();
      await feed.keyboard.press('Escape');
    });

    await beat('CP4 calendar insert, open link', 8_000, async () => {
      // The Langer card (DEMO.md CP4 beat 1), else the drawer's card.
      const list = (await (await feed.request.get('/api/events?q=Langer')).json()).events as { id: string; title: string; start: string }[];
      let event = list.find((e) => /langer/i.test(e.title));
      if (!event) {
        expect(drawerId, 'no Langer event and no drawer card to add').toBeTruthy();
        event = (await (await feed.request.get(`/api/events/${drawerId}`)).json()) as { id: string; title: string; start: string };
      }
      // Sim auth: sign in as the first demo student (sets the cookie on this context).
      const userId = ((await (await feed.request.get('/api/auth')).json()).students[0].id) as string;
      expect((await feed.request.post('/api/auth', { data: { userId } })).status()).toBe(200);

      const res = await feed.request.post('/api/gcal/insert', { data: { eventId: event.id } });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as { mode: string; link: string };
      console.log(`gcal insert: ${body.mode} ${body.link} (${event.title})`);
      if (body.mode !== 'sim') return; // live: the link is Google's; check the phone
      // The sim calendar shows one week; open the event's week (start is NY local, so its date prefix is the NY day).
      await feed.goto(`${body.link}${body.link.includes('?') ? '&' : '?'}week=${event.start.slice(0, 10)}`);
      await expect(feed.getByText(event.title).first()).toBeVisible({ timeout: WAIT });
    });

    await beat('CP4 free food feed and digest', 5_000, async () => {
      expect((await feed.request.get('/api/feeds/free-food.ics')).status()).toBe(200);
      expect((await feed.request.get('/api/digest/preview')).status()).toBe(200);
    });
  } finally {
    const rows = timings.map(
      (t) => `${t.ms > t.budget ? 'OVER' : 'ok  '}  ${String(t.ms).padStart(6)} ms / ${String(t.budget).padStart(6)} ms  ${t.beat}`,
    );
    console.log(['', 'Rehearsal timings (soft budgets):', ...rows, ''].join('\n'));
    await reset();
  }
});

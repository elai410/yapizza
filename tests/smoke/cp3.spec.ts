// CP3 smoke: Ask, dedup and the "How this was read" drawer.
// The DEDUP tests WRITE demo data (a YUMS email and its room change). Run `pnpm demo:reset`
// (human, plain terminal) before a live demo so the demo send-ins start fresh.
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import type { AskResponse, EventCard, EventDetail, IngestResult } from '../../src/lib/contracts/types';
import { forCp, gotoApp } from './helpers';

const cards = (page: Page) => page.getByTestId('event-card');
const PLACE_FIELDS = ['placeId', 'placeName', 'locationRaw'];

// Sends the YUMS weekly, then its room change; returns the room change's IngestResult.
async function sendRoomChange(request: APIRequestContext): Promise<IngestResult> {
  const sent = await request.post('/api/demo/send-email', {
    data: { fixture: '34-yums-weekly-nov-16.json' },
    timeout: 30_000,
  });
  expect(sent.status()).toBe(200);
  const res = await request.post('/api/demo/room-change', { data: {}, timeout: 30_000 });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: boolean; detail: string; result?: IngestResult };
  expect(body.ok).toBe(true);
  expect(body.result).toBeDefined();
  return body.result!;
}

test.describe('CP3 ask API', () => {
  forCp(3, 'ASK');
  test.setTimeout(30_000); // Grok tool calling

  test('POST /api/ask answers with events that exist', async ({ request }) => {
    const res = await request.post('/api/ask', { data: { q: 'free food this week' }, timeout: 30_000 });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as AskResponse;
    expect(typeof body.answer).toBe('string');
    expect(['grok', 'fallback']).toContain(body.mode);
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeGreaterThan(0);
    for (const r of body.results) {
      expect(typeof r.event.id).toBe('string');
      expect(typeof r.why).toBe('string');
      expect((await request.get(`/api/events/${r.event.id}`)).status()).toBe(200);
    }
  });
});

test.describe('CP3 ask page', () => {
  forCp(3, 'ASK');
  test.setTimeout(45_000);

  test('/ask shows event cards, and the Grok line when Grok answered', async ({ page, request }) => {
    const status = await (await request.get('/api/integrations/status')).json();
    await gotoApp(page, '/ask');
    const box = page.getByLabel('Ask Yapizza');
    await box.fill('free food this week');
    const response = page.waitForResponse((r) => r.url().endsWith('/api/ask') && r.request().method() === 'POST', {
      timeout: 30_000,
    });
    await box.press('Enter');
    const answer = (await (await response).json()) as AskResponse;

    const result = page.getByTestId('ask-result');
    await expect(result.getByTestId('event-card').first()).toBeVisible({ timeout: 30_000 });
    // "Read by Grok" is hidden on purpose in fallback mode.
    if (status.grok !== 'replay' && answer.mode === 'grok') {
      await expect(page.getByText(/Read by Grok/).first()).toBeVisible();
    }
  });
});

test.describe('CP3 dedup', () => {
  forCp(3, 'DEDUP');
  test.setTimeout(60_000); // two Grok extractions plus a match

  test('a room change updates the existing card instead of adding one', async ({ request }) => {
    const result = await sendRoomChange(request);
    expect(result.created.length).toBe(0);

    // Check end state, not this run's counts: on a repeat run dedup rightly returns `same` (updated: []).
    const list = await request.get('/api/events?q=Research%20Panel');
    expect(list.status()).toBe(200);
    const panels = ((await list.json()).events as EventCard[]).filter(
      (e) => /research panel/i.test(e.title) && e.status === 'live',
    );
    expect(panels).toHaveLength(1);
    expect(
      panels[0].updatedFields.some((f) => PLACE_FIELDS.includes(f)),
      `updatedFields: ${JSON.stringify(panels[0].updatedFields)}, place: ${panels[0].placeName}`,
    ).toBe(true);
  });

  test('the feed card shows Updated after a room change', async ({ page, request }) => {
    await sendRoomChange(request);
    await gotoApp(page, '/');
    const card = cards(page).filter({ hasText: /research panel/i }).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    await expect(card).toContainText('Updated');
  });
});

test.describe('CP3 source drawer', () => {
  forCp(3, 'SOURCE_DRAWER');

  test('"How this was read" shows the source with evidence highlighted', async ({ page, request }) => {
    // The feed shows only this week, so open a card it renders and fetch that event's detail by id.
    await gotoApp(page, '/');
    const card = cards(page).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    const id = await card.getAttribute('data-event-id');
    expect(id).toBeTruthy();
    const res = await request.get(`/api/events/${id}`);
    expect(res.status()).toBe(200);
    const detail = (await res.json()) as EventDetail;
    await card.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /how this was read/i }).click();
    await expect(dialog.getByText(/Read by Grok/)).toBeVisible();
    await expect(dialog.locator('mark').first()).toBeVisible();
    const shown = detail.source.subject ?? detail.source.sender;
    if (shown) await expect(dialog).toContainText(shown);
  });
});

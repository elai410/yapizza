// CP4 smoke: calendar feeds, Google Calendar insert, saves, free food alerts and the digest.
// The GCAL_INSERT and ALERTS tests WRITE demo data (sim calendar entries, saves, an alert subscriber,
// a free-food-now email and its outbox message). Run `pnpm demo:reset` (human, plain terminal) before a live demo.
import { test, expect, type APIRequestContext } from '@playwright/test';
import type { EventCard, IntegrationStatus } from '../../src/lib/contracts/types';
import { forCp, gotoApp } from './helpers';

// First upcoming live event, else the first live one at all; never a hard-coded id.
async function firstLiveEvent(request: APIRequestContext): Promise<EventCard> {
  for (const q of [`?from=${encodeURIComponent(new Date().toISOString())}`, '']) {
    const res = await request.get(`/api/events${q}`);
    expect(res.status()).toBe(200);
    const live = ((await res.json()).events as EventCard[]).find((e) => e.status === 'live');
    if (live) return live;
  }
  throw new Error('no live events in /api/events');
}

// Signs the shared request context in as the first demo student (sim auth sets the yp_user cookie).
async function signIn(request: APIRequestContext) {
  const auth = await request.get('/api/auth');
  expect(auth.status()).toBe(200);
  const userId = (await auth.json()).students[0].id as string;
  const res = await request.post('/api/auth', { data: { userId } });
  expect(res.status()).toBe(200);
}

function expectCalendar(body: string) {
  const ics = body.trim();
  expect(ics.startsWith('BEGIN:VCALENDAR')).toBe(true);
  expect(ics.endsWith('END:VCALENDAR')).toBe(true);
}

test.describe('CP4 calendar feeds', () => {
  forCp(4, 'CAL_FEEDS');

  test('GET /api/feeds/all.ics is a calendar with events', async ({ request }) => {
    const res = await request.get('/api/feeds/all.ics');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/calendar');
    const body = await res.text();
    expectCalendar(body);
    expect(body).toContain('BEGIN:VEVENT');
  });

  test('GET /api/feeds/free-food.ics is a calendar', async ({ request }) => {
    const res = await request.get('/api/feeds/free-food.ics');
    expect(res.status()).toBe(200);
    expectCalendar(await res.text());
  });

  test('an unknown feed is 404', async ({ request }) => {
    expect((await request.get('/api/feeds/nope-not-a-feed.ics')).status()).toBe(404);
  });
});

test.describe('CP4 Google Calendar insert', () => {
  forCp(4, 'GCAL_INSERT');

  test('POST /api/gcal/insert adds the event, and sim mode shows it on /sim/calendar', async ({ page, request }) => {
    const event = await firstLiveEvent(request);
    await signIn(request);
    const res = await request.post('/api/gcal/insert', { data: { eventId: event.id } });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { mode: string; link: string };
    expect(['live', 'sim']).toContain(body.mode);
    expect(typeof body.link).toBe('string');
    expect(body.link.length).toBeGreaterThan(0);
    if (body.mode !== 'sim') return;

    expect(body.link).toContain('/sim/calendar');
    // The sim calendar shows one week; open the week of the event (start is NY local, so its date prefix is the NY day).
    await page.goto(`/sim/calendar?week=${event.start.slice(0, 10)}`);
    await expect(page.getByText(event.title).first()).toBeVisible();
  });

  test('the student UI never says simulated', async ({ page, request }) => {
    const event = await firstLiveEvent(request);
    await gotoApp(page, '/');
    const card = page.getByTestId('event-card').filter({ hasText: event.title }).first();
    const visible = await card.waitFor({ timeout: 10_000 }).then(
      () => true,
      () => false,
    );
    test.skip(!visible, `"${event.title}" is not in this week's feed`);
    await expect(page.locator('body')).not.toContainText(/simulat/i);
    await card.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText(/simulat/i);
  });
});

test.describe('CP4 saves', () => {
  forCp(4, 'GCAL_INSERT');

  test('POST /api/saves saves an event for the signed-in student', async ({ request }) => {
    const event = await firstLiveEvent(request);
    await signIn(request);
    const res = await request.post('/api/saves', { data: { eventId: event.id } });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

test.describe('CP4 free food alerts', () => {
  forCp(4, 'ALERTS');
  test.setTimeout(45_000); // Grok extraction plus the outbox wait

  test('a subscriber gets a free food alert in the outbox', async ({ page, request }) => {
    const target = 'smoke@example.com';
    const sub = await request.post('/api/alerts/subscribe', { data: { channel: 'email', target, freeFood: true } });
    expect(sub.status()).toBe(200);
    expect(await sub.json()).toEqual({ ok: true });

    const sent = await request.post('/api/demo/free-food-now', { data: {}, timeout: 30_000 });
    expect(sent.status()).toBe(200);
    expect((await sent.json()).ok).toBe(true);

    const status = (await (await request.get('/api/integrations/status')).json()) as IntegrationStatus;
    test.skip(status.notify !== 'sim', 'notify is live; the alert went out through Resend, not /sim/outbox');
    // The outbox page refreshes itself; reload too in case its interval is long.
    await expect(async () => {
      await page.goto('/sim/outbox');
      await expect(page.getByText(target).first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  });
});

test.describe('CP4 digest', () => {
  forCp(4, 'DIGEST');

  test('GET /api/digest/preview returns a digest of real events', async ({ request }) => {
    const res = await request.get('/api/digest/preview');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { subject: unknown; html: unknown; eventIds: unknown };
    expect(typeof body.subject).toBe('string');
    expect(typeof body.html).toBe('string');
    expect(body.html as string).toContain('<');
    expect(Array.isArray(body.eventIds)).toBe(true);
    for (const id of body.eventIds as unknown[]) {
      expect(typeof id).toBe('string');
      expect((await request.get(`/api/events/${id}`)).status()).toBe(200);
    }
  });
});

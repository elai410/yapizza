// CP2 smoke: live intake. These tests WRITE demo data (an ingested email, an uploaded flyer).
// Press Reset demo (/demo key 5) before a live demo so the demo send-ins start fresh.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import type { EventCard, IngestResult } from '../../src/lib/contracts/types';
import { forCp, gotoApp } from './helpers';

const EMAIL_FIXTURE = join(process.cwd(), 'fixtures/emails/34-yums-weekly-nov-16.json');
const FLYER = join(process.cwd(), 'fixtures/flyers/helix-langer-flyer.png');

function expectIngestResult(body: IngestResult) {
  expect(typeof body.sourceId).toBe('string');
  expect(Array.isArray(body.created)).toBe(true);
  expect(Array.isArray(body.updated)).toBe(true);
  expect(typeof body.listings).toBe('number');
  expect(typeof body.inReview).toBe('number');
  expect(typeof body.ms).toBe('number');
}

test.describe('CP2 email ingest', () => {
  forCp(2, 'INGEST');
  test.setTimeout(30_000); // Claude

  test('POST /api/ingest/email turns a club email into events', async ({ request }) => {
    const email = JSON.parse(readFileSync(EMAIL_FIXTURE, 'utf8'));
    const res = await request.post('/api/ingest/email', { data: email, timeout: 30_000 });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as IngestResult;
    expectIngestResult(body);

    // Repeat runs return nothing new (same messageId), and review cards are hidden from /api/events,
    // so search by a live card's title when there is one and fall back to the seeded YUMS event.
    const live = body.created.concat(body.updated).find((e: EventCard) => e.status === 'live');
    const word = live?.title.split(/\s+/).find((w) => w.length >= 4) ?? 'PSET';
    const list = await request.get(`/api/events?q=${encodeURIComponent(word)}`);
    expect(list.status()).toBe(200);
    expect((await list.json()).events.length).toBeGreaterThan(0);
  });
});

test.describe('CP2 flyer upload', () => {
  forCp(2, 'UPLOAD');
  test.setTimeout(45_000); // page load plus up to 30s of Claude vision

  test('uploading a flyer on /host/upload shows its event card', async ({ page }) => {
    await gotoApp(page, '/host/upload');
    await page.getByTestId('upload-input').setInputFiles(FLYER);

    const response = page.waitForResponse((r) => r.url().endsWith('/api/upload') && r.request().method() === 'POST', {
      timeout: 30_000,
    });
    await page.getByTestId('upload-submit').click();
    // The processing state can be too quick to catch in replay mode, so this check is soft.
    await page.getByRole('status').waitFor({ timeout: 1_000 }).catch(() => {});

    const res = await response;
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { created: unknown[]; updated: unknown[] };
    const result = page.getByTestId('upload-result');
    await expect(result).toBeVisible({ timeout: 30_000 });
    if (body.created.length + body.updated.length > 0) {
      await expect(result.locator('[data-testid="event-card"]').first()).toBeVisible();
    } else {
      // A repeat upload is matched as `same` by dedup (CP3); the flyer's event must already be listed.
      const list = await (await page.request.get('/api/events?q=Langer')).json();
      expect(list.events.length).toBeGreaterThan(0);
    }
  });
});

test.describe('CP2 live updates', () => {
  forCp(2, 'LIVE_UPDATES');

  test('the feed polls /api/events', async ({ page }) => {
    test.skip(process.env.NEXT_PUBLIC_DATA === 'fixtures', 'the feed does not poll with NEXT_PUBLIC_DATA=fixtures');
    // Contract 8.3: after one full load the feed polls /api/events?...&since=<serverTime> every 3s.
    let sincePolls = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/events?') && r.url().includes('since=')) sincePolls++;
    });
    await gotoApp(page, '/');
    await expect.poll(() => sincePolls, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  });
});

test.describe('CP2 demo panel', () => {
  forCp(2, 'DEMO_PANEL');

  test('/demo shows integration status and the six actions', async ({ page }) => {
    const res = await gotoApp(page, '/demo');
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId('demo-status')).toBeVisible();
    for (let i = 1; i <= 6; i++) await expect(page.getByTestId(`demo-action-${i}`)).toBeVisible();
  });
});

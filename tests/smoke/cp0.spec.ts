import { test, expect } from '@playwright/test';
import { forCp, gotoApp } from './helpers';

test.describe('CP0 foundation', () => {
  forCp(0);

  test('app boots with a header and no page errors', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (err) => errors.push(err));

    const response = await gotoApp(page, '/');
    expect(response?.status()).toBe(200);

    const header = page.getByRole('banner').or(page.getByText('Yapizza')).first();
    await expect(header).toBeVisible();
    expect(errors.map((e) => e.message)).toEqual([]);
  });

  test('GET /api/integrations/status returns IntegrationStatus', async ({ request }) => {
    const res = await request.get('/api/integrations/status');
    expect(res.status()).toBe(200);
    const body = await res.json();
    for (const key of ['grok', 'gmail', 'gcal', 'notify', 'auth', 'forcedSim']) {
      expect(body).toHaveProperty(key);
    }
  });
});

test.describe('CP0 intro', () => {
  forCp(0, 'INTRO');

  test('intro, if present, is skipped by a key press', async ({ page }) => {
    await page.goto('/');
    const intro = page.locator('[data-testid="intro"]');
    // Design may land the intro after CP0; with no intro element there is nothing to skip.
    if ((await intro.count()) > 0) {
      await page.keyboard.press('Space');
      await expect(intro).toBeHidden({ timeout: 3_000 });
    }
  });
});

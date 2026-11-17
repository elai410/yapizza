import { test, expect, type Page } from '@playwright/test';
import { forCp, gotoApp } from './helpers';

// Each feed card is a <button data-testid="event-card">.
const cards = (page: Page) => page.getByTestId('event-card');

test.describe('CP1 events API', () => {
  forCp(1, 'FEED');

  test('GET /api/events lists events', async ({ request }) => {
    const res = await request.get('/api/events');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.serverTime).toBe('string');
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBeGreaterThan(0);
    for (const e of body.events) {
      expect(typeof e.id).toBe('string');
      expect(typeof e.title).toBe('string');
      expect(Number.isNaN(Date.parse(e.start))).toBe(false);
      expect(Array.isArray(e.tags)).toBe(true);
    }
  });

  test('GET /api/events/[id] returns EventDetail', async ({ request }) => {
    const list = await (await request.get('/api/events')).json();
    const id = list.events[0].id;
    const res = await request.get(`/api/events/${id}`);
    expect(res.status()).toBe(200);
    const detail = await res.json();
    expect(detail.id).toBe(id);
    expect(detail.gcalTemplateUrl).toMatch(/^https:\/\/calendar\.google\.com\/calendar\//);
    expect(typeof detail.source).toBe('object');
    expect(detail.source).not.toBeNull();
  });
});

test.describe('CP1 feed', () => {
  forCp(1, 'FEED');

  test('feed shows event cards', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(cards(page).first()).toBeVisible({ timeout: 10_000 });
  });

  test('clicking a card opens the detail sheet with its title', async ({ page }) => {
    await gotoApp(page, '/');
    const card = cards(page).first();
    await expect(card).toBeVisible({ timeout: 10_000 });
    const cardText = await card.innerText();

    await card.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // A button's children are presentational, so read the title from the sheet's heading instead.
    // The heading is a hidden "Event" placeholder until the detail loads, so poll.
    const heading = dialog.getByRole('heading').first();
    await expect
      .poll(async () => {
        const title = (await heading.textContent())?.trim() ?? '';
        return title.length > 0 && cardText.includes(title);
      }, { timeout: 10_000 })
      .toBe(true);
  });
});

test.describe('CP1 filters', () => {
  forCp(1, 'FILTERS');

  test('free food filter narrows the feed', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(cards(page).first()).toBeVisible({ timeout: 10_000 });
    const chip = page.getByRole('button', { name: 'Free food', exact: true });
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');

    // Pass when the empty state shows, or every card's accessible name mentions free food.
    const freeFoodCards = page.getByRole('button', { name: /free food/i }).and(cards(page));
    await expect
      .poll(async () => {
        if (await page.getByTestId('empty-state').isVisible()) return true;
        const total = await cards(page).count();
        return total > 0 && total === (await freeFoodCards.count());
      }, { timeout: 10_000 })
      .toBe(true);
  });
});

test.describe('CP1 calendar link', () => {
  forCp(1, 'GCAL_LINK');

  test('detail sheet links to a Google Calendar template', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(cards(page).first()).toBeVisible({ timeout: 10_000 });
    await cards(page).first().click();

    const link = page.getByRole('dialog').getByRole('link', { name: /add to calendar/i });
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render/);
    expect(href).toContain('action=TEMPLATE');
  });
});

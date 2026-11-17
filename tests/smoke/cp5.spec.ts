// CP5 smoke: sales board, traditions, and the host page and endpoints.
// These tests WRITE demo data (a fixture 36 ingest, a host claim, an edited then restored title,
// a canceled event). Press Reset demo (/demo key 5) before a live demo.
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import type { EventCard, EventDetail, IngestResult } from '../../src/lib/contracts/types';
import type { HostSummary, MyHost } from '../../src/lib/db/host';
import type { ListingItem, TraditionItem } from '../../src/lib/db/listings';
import { DEMO_STUDENTS } from '../../src/lib/adapters/demo-students';
import { forCp, gotoApp } from './helpers';

// Signs the request context in as the first demo student (sim auth sets the yp_user cookie).
async function signIn(request: APIRequestContext) {
  const auth = await request.get('/api/auth');
  expect(auth.status()).toBe(200);
  const userId = (await auth.json()).students[0].id as string;
  const res = await request.post('/api/auth', { data: { userId } });
  expect(res.status()).toBe(200);
}

async function sendFixture(request: APIRequestContext, fixture: string): Promise<IngestResult> {
  const res = await request.post('/api/demo/send-email', { data: { fixture }, timeout: 30_000 });
  expect(res.status()).toBe(200);
  return (await res.json()).result as IngestResult;
}

function collectPageErrors(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (e) => errors.push(e));
  return errors;
}

async function listings(request: APIRequestContext): Promise<ListingItem[]> {
  const res = await request.get('/api/listings');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { listings: ListingItem[] };
  expect(Array.isArray(body.listings)).toBe(true);
  return body.listings;
}

test.describe('CP5 sales board', () => {
  forCp(5, 'SALES');
  test('GET /api/listings and /sales show the seeded OCAY sale', async ({ page, request }) => {
    // The seed carries the OCAY sale. Never send fixture 37: listings are not deduped.
    // Reset only when it is missing, so parallel tests keep their data.
    let items = await listings(request);
    if (items.length === 0) {
      expect((await request.post('/api/demo/reset', { data: {} })).status()).toBe(200);
      items = await listings(request);
    }
    expect(items.length).toBeGreaterThan(0);
    const errors = collectPageErrors(page);
    const res = await gotoApp(page, '/sales');
    expect(res?.status()).toBe(200);
    await expect(page.getByText(items[0].title).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('CP5 traditions', () => {
  forCp(5, 'TRADITIONS');

  test('GET /api/traditions and /traditions render the list or an empty state', async ({ page, request }) => {
    const api = await request.get('/api/traditions');
    expect(api.status()).toBe(200);
    const items = ((await api.json()) as { traditions: TraditionItem[] }).traditions;
    expect(Array.isArray(items)).toBe(true);

    const errors = collectPageErrors(page);
    const res = await gotoApp(page, '/traditions');
    expect(res?.status()).toBe(200);
    if (items.length === 0) await expect(page.getByTestId('empty-state')).toBeVisible();
    else await expect(page.getByText(items[0].title).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('CP5 host endpoints', () => {
  forCp(5, 'HOST');
  test.setTimeout(60_000); // Claude extraction of fixture 36

  test('claim, list, edit and restore, cancel; reach is totals only', async ({ request }) => {
    expect((await request.get('/api/host/me')).status()).toBe(401);
    await signIn(request);

    // A members-only OCAY meeting, created here so a canceled seeded event never reaches the demo.
    const ingest = await sendFixture(request, '36-ocay-trip-leaders-members-only.json');
    const created: EventCard | undefined = ingest.created[0] ?? ingest.updated[0];
    // A repeat run dedups fixture 36 to `same` against the event an earlier run canceled.
    test.skip(!created, 'fixture 36 was already ingested; press Reset demo to rerun this test');
    expect(created!.hostName, 'fixture 36 event has no host').toBeTruthy();

    const found = await request.get(`/api/host/hosts?q=${encodeURIComponent(created!.hostName!)}`);
    expect(found.status()).toBe(200);
    const host = ((await found.json()) as { hosts: HostSummary[] }).hosts.find((h) => h.name === created!.hostName);
    expect(host, `host "${created!.hostName}" not in /api/host/hosts`).toBeTruthy();

    const claim = await request.post('/api/host/claim', { data: { hostId: host!.id } });
    expect(claim.status()).toBe(200);
    expect((await claim.json()).host.claimed).toBe(true);

    const me = await request.get('/api/host/me');
    expect(me.status()).toBe(200);
    const meText = await me.text();
    const mine = (JSON.parse(meText) as { hosts: MyHost[] }).hosts.find((h) => h.id === host!.id);
    expect(mine).toBeTruthy();
    expect(mine!.events.map((e) => e.event.id)).toContain(created!.id);
    for (const n of [mine!.totals.events, mine!.totals.views, mine!.totals.saves]) expect(typeof n).toBe('number');
    for (const e of mine!.events) {
      expect(typeof e.reach.views).toBe('number');
      expect(typeof e.reach.saves).toBe('number');
    }
    for (const s of DEMO_STUDENTS) {
      expect(meText).not.toContain(s.netid);
      expect(meText).not.toContain(s.name);
    }

    const original = created!.title;
    const edited = `${original} (smoke edit)`;
    const patch = await request.patch(`/api/host/events/${created!.id}`, { data: { title: edited } });
    expect(patch.status()).toBe(200);
    expect(((await patch.json()) as EventCard).title).toBe(edited);
    const detail = (await (await request.get(`/api/events/${created!.id}`)).json()) as EventDetail;
    expect(detail.title).toBe(edited);
    expect((await request.patch(`/api/host/events/${created!.id}`, { data: { title: original } })).status()).toBe(200);
    expect(((await (await request.get(`/api/events/${created!.id}`)).json()) as EventDetail).title).toBe(original);

    const cancel = await request.post(`/api/host/events/${created!.id}/cancel`);
    expect(cancel.status()).toBe(200);
    expect(((await (await request.get(`/api/events/${created!.id}`)).json()) as EventDetail).status).toBe('canceled');
  });
});

test.describe('CP5 host page', () => {
  forCp(5, 'HOST');

  test('/host loads and, signed in, shows the claimed host', async ({ page }) => {
    const errors = collectPageErrors(page);
    const res = await gotoApp(page, '/host');
    expect(res?.status()).toBe(200);

    // page.request shares the page's cookies, so the page sees this sign-in.
    await signIn(page.request);
    // Claim the host of an upcoming event so the dashboard has a row to show.
    const from = encodeURIComponent(new Date().toISOString());
    const upcoming = ((await (await page.request.get(`/api/events?from=${from}`)).json()) as { events: EventCard[] }).events;
    let claimed: { host: HostSummary; event: EventCard } | undefined;
    for (const event of upcoming.filter((e) => e.status === 'live' && e.hostName)) {
      const q = encodeURIComponent(event.hostName!);
      const hosts = ((await (await page.request.get(`/api/host/hosts?q=${q}`)).json()) as { hosts: HostSummary[] }).hosts;
      const host = hosts.find((h) => h.name === event.hostName);
      // 409 means another officer holds it; take the first one this student can claim.
      if (host && (await page.request.post('/api/host/claim', { data: { hostId: host.id } })).status() === 200) {
        claimed = { host, event };
        break;
      }
    }
    expect(claimed, 'no claimable host with an upcoming event').toBeTruthy();

    await gotoApp(page, '/host');
    await expect(page.getByRole('heading', { name: claimed!.host.name }).first()).toBeVisible();
    await expect(page.getByText(claimed!.event.title).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});

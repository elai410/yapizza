# Yapizza QA

Owner: qa-demo. Smoke tests gate every checkpoint. Bugs go to the Bugs list in COORDINATION.md with an owner.

## Running smoke tests

- `pnpm test:smoke` runs `tests/smoke` with Playwright against `http://localhost:3000`. It reuses a running `pnpm dev`; if none is up, Playwright starts one.
- Gate a checkpoint: `SMOKE_CP=<n> pnpm test:smoke`. Tests above checkpoint n are skipped, and so are tests whose flag is off (`NEXT_PUBLIC_MAX_CP`, `NEXT_PUBLIC_FLAGS_OFF`). Without `SMOKE_CP` it falls back to `NEXT_PUBLIC_MAX_CP`, then 5.
- One file: `pnpm exec playwright test tests/smoke/cp1.spec.ts`. Watch it: add `--headed`.
- Each test calls `forCp(cp, flag)` from `tests/smoke/helpers.ts`, and `gotoApp(page, path)` to open a page with the intro already skipped.
- Full gate: `pnpm demo:check` (typecheck, smoke, integration status).
- Seed must be loaded first: `pnpm db:reset`, run by the human in a plain terminal (Prisma refuses `migrate reset` from Claude Code). CP1 API tests expect at least one event.

## Selectors the tests rely on

Owners: keep these stable. Changing one breaks the gate.

| What | Selector | Owner |
|---|---|---|
| Intro root | `data-testid="intro"` | design |
| Intro skip | sessionStorage `yapizza:intro-seen` = `'1'` skips it; any key or click skips it | design |
| Feed card | `data-testid="event-card"`, one per card | frontend |
| Detail sheet | element with role `dialog` | frontend |
| Calendar link | link named "Add to calendar", href starts with `https://calendar.google.com/calendar/render?action=TEMPLATE` | frontend |
| Free food filter | button named "Free food" | frontend |
| Events API | GET /api/events returns `{ events, serverTime }`; GET /api/events/[id] returns EventDetail with `gcalTemplateUrl` | api |

## Manual checklist

Run in a fresh window with `pnpm dev` up and after Reset demo (/demo key 5). Check each at desktop width and at 390px.

### CP0
- [ ] `/` loads with no console errors.
- [ ] Intro plays once per browser session, under 2.5 s; a key or click skips it.
- [ ] Reduced motion: intro is a short fade.
- [ ] Header shows the wordmark; Tab reaches the nav with a visible focus ring.

### CP1
- [ ] This week shows seeded cards with real dates (Weighing of Handsome Dan on Tue, Nov 17 · 8:30 PM).
- [ ] Today shows only Nov 17 events.
- [ ] Free food narrows to food events only (YASSS Dinner, WaMH Talk). Clearing it restores the list.
- [ ] Card shows time, title, place, host, at most two tag chips, free food marker. Nothing else.
- [ ] Card opens the detail sheet by click and by Enter; Escape closes it and returns focus.
- [ ] Add to calendar opens Google Calendar with the right title, time (America/New_York), and place.
- [ ] Empty filter result shows one plain sentence.

### CP2
- [ ] `/demo` shows live or sim for every service.
- [ ] Sending `34-yums-weekly-nov-16` adds three cards within 10 s without a reload, highlighted.
- [ ] Uploading `helix-langer-flyer.png` adds Fireside Chat with Robert Langer, Fri Nov 20, 1:15 PM, LC 101.
- [ ] `/host/upload` shows a processing state, then the result.
- [ ] Sending the same email twice adds nothing the second time.

### CP3
- [ ] Room change (39) moves the Math Research Panel to LC 102, shows Updated, no duplicate.
- [ ] Cancellation (40) marks Politics of the Purse canceled.
- [ ] 21 then 22 leave one AASA Night Market card.
- [ ] "free food tonight" returns food events only, with a short why each; with Grok down it still answers (`mode: 'fallback'`).
- [ ] "How this was read" shows the source with evidence quotes highlighted and one "Read by Grok" line.

### CP4
- [ ] Add to calendar inserts live, or lands on `/sim/calendar` in sim.
- [ ] Free food alert opt-in, then Free food now: toast in app, message in `/sim/outbox` (sim) or inbox (live).
- [ ] `/api/feeds/free-food.ics` imports into a calendar app.
- [ ] Digest preview renders this week's events.
- [ ] `YAPIZZA_FORCE_SIM=1` drill: every CP0 to CP4 step still works.

### CP5
- [ ] `/host` shows totals only, never names.
- [ ] `/sales` shows the OCAY gear sale as a listing.
- [ ] `/traditions` lists The Game.
- [ ] Members-only OCAY trip meeting (36) does not appear in the open feed.
- [ ] Copy pass: no exclamation marks, no em dashes, no banned words, no "simulated" outside `/sim` and `/demo`.

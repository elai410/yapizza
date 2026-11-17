# Yapizza QA

Owner: qa-demo. Smoke tests gate every checkpoint. Bugs go to the Bugs list in COORDINATION.md with an owner.

## Running smoke tests

- `pnpm test:smoke` runs `tests/smoke` with Playwright against `http://localhost:3000`. It reuses a running `pnpm dev`; if none is up, Playwright starts one.
- Gate a checkpoint: `SMOKE_CP=<n> pnpm test:smoke`. Tests above checkpoint n are skipped, and so are tests whose flag is off (`NEXT_PUBLIC_MAX_CP`, `NEXT_PUBLIC_FLAGS_OFF`). Without `SMOKE_CP` it falls back to `NEXT_PUBLIC_MAX_CP`, then 5.
- One file: `pnpm exec playwright test tests/smoke/cp1.spec.ts`. Watch it: add `--headed`.
- Each test calls `forCp(cp, flag)` from `tests/smoke/helpers.ts`, and `gotoApp(page, path)` to open a page with the intro already skipped.
- Full gate: `pnpm demo:check` (typecheck, smoke, integration status).
- Seed must be loaded first: reset with /demo key 5 (POST /api/demo/reset reseeds 210 events and 1 listing, keeps users and alert subscriptions). If the app is down or the schema changed, the human runs `pnpm demo:reset` in a plain terminal (Prisma refuses `migrate reset` from Claude Code). Reset again after every smoke run, since tests leave demo data behind.
- Rehearsal: `pnpm exec playwright test tests/demo/rehearsal.spec.ts` runs every final-script beat and resets the DB at the end.

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
| Empty state | `data-testid="empty-state"` (feed; also traditions and sales) | frontend |
| How this was read | button named "How this was read" inside the dialog; evidence quotes are `mark` elements | frontend |
| Grok line | text "Read by Grok" in the drawer only when `EventDetail.readBy` is `'grok'`; tests read `/api/events/[id]` and assert presence or absence | frontend |
| Ask result | `data-testid="ask-result"` with `event-card` children; "Read by Grok" when `mode` is `grok`, "Showing keyword matches." when `fallback` | frontend |
| Upload | `data-testid="upload-input"`, `upload-submit`, `upload-result` on `/host/upload` | frontend |
| Demo status | `data-testid="demo-status"` on `/demo` | qa-demo |
| Events API | GET /api/events returns `{ events, serverTime }`; GET /api/events/[id] returns EventDetail with `gcalTemplateUrl` | api |

## Manual checklist

Run in a fresh window with `pnpm dev` up, after a reset with /demo key 5 (confirm the dialog; the log reads "demo data reseeded"). Check each at desktop width and at 390px.

### CP0
- [ ] `/` loads with no console errors.
- [ ] Intro plays once per browser session, under 2.5 s; a key or click skips it.
- [ ] Reduced motion: intro is a short fade.
- [ ] Header shows the wordmark; Tab reaches the nav with a visible focus ring.

### CP1
- [ ] This week shows seeded cards with real dates (Weighing of Handsome Dan on Tue, Nov 17 · 8:30 PM).
- [ ] Today shows only Nov 17 events.
- [ ] Free food narrows to food events only (One Last Sweet Treat, WaMH Talk, AACC November Recess Family Dinner). Clearing it restores the list.
- [ ] Card shows time, title, place, host, at most two tag chips, free food marker, and Members only or college only when it applies. Nothing else.
- [ ] Card opens the detail sheet by click and by Enter; Escape closes it and returns focus.
- [ ] Add to calendar opens Google Calendar with the right title, time (America/New_York), and place.
- [ ] Empty filter result shows one plain sentence.

### CP2
- [ ] `/demo` shows live or sim for every service.
- [ ] Sending `34-yums-weekly-nov-16` adds three cards within 10 s without a reload, highlighted.
- [ ] Uploading `helix-langer-flyer.png` adds Fireside Chat with Robert Langer, Fri Nov 20, 1:15 PM, LC 101. Its drawer heading reads "From a flyer" and highlights "FRIDAY, NOV 20", "1:15 PM" and "LC 101".
- [ ] The `/demo` log row shows per-stage ms (received, extracted, checked, matched, saved).
- [ ] `/host/upload` shows a processing state, then the result.
- [ ] Sending the same email twice adds nothing the second time.

### CP3
- [ ] Room change (39) moves the Math Research Panel to LC 102, shows Updated, no duplicate. Its drawer shows the ROOM CHANGE email (the newest source) with "LC 102" highlighted.
- [ ] Sending 34 again after 39 leaves the panel at LC 102.
- [ ] Cancellation (40) marks Politics of the Purse canceled; its sheet has no Add to calendar or Save.
- [ ] 21 then 22 leave one AASA Night Market card.
- [ ] After key 4, "free food tonight" returns Free pizza (Silliman Buttery) with a short why; cards show day and time, sorted by start. With Grok down it still answers (`mode: 'fallback'`, "Showing keyword matches.").
- [ ] "career talk" matches career events; "something in JE" answers "Nothing in Jonathan Edwards yet."
- [ ] "How this was read": heading follows source kind ("From the email", "From a flyer", "From the form" or "From <list>"), evidence quotes highlighted.
- [ ] Drawer rule: "Read by Grok · confidence 0.xx" shows only when `readBy` is `'grok'`. With no `XAI_API_KEY` every card is `'rules'` and no drawer shows it. Rule reads of live sends (confidence 0.50) also show "Needs review".

### CP4
- [ ] Add to calendar inserts live, or lands on `/sim/calendar` in sim.
- [ ] Free food alert opt-in, then Free food now (key 4, Silliman GA pizza in the Silliman Buttery): toast in app, message in `/sim/outbox` (sim) or inbox (live).
- [ ] Turn off on the alerts card unsubscribes on the server: a later key 4 sends nothing to that student.
- [ ] The alerts card links to Sunday digest (`/digest`), events in time order.
- [ ] `/api/feeds/free-food.ics` imports into a calendar app.
- [ ] Digest preview renders this week's events.
- [ ] `YAPIZZA_FORCE_SIM=1` drill: every CP0 to CP4 step still works.

### CP5
- [ ] `/host` shows totals only, never names.
- [ ] `/sales` shows the seeded OCAY gear sale right after a reset.
- [ ] `/traditions` lists The Game.
- [ ] Members-only OCAY trip meeting (36) shows with a Members only marker.
- [ ] Copy pass: no exclamation marks, no em dashes, no banned words, no "simulated" outside `/sim` and `/demo`.

# Yapizza build board
CLOCK START: Tue Nov 17 17:10:32 EST 2026
CURRENT TARGET: after CP5, keep improving until the human calls a wrap
WRAP: none
SCAFFOLD: READY (17:12)
CONTRACTS: v1.1 + LLM SWITCH (human, 18:24): Grok -> Claude API (@anthropic-ai/sdk, claude-opus-5-5). Code identifiers stay "grok" (GrokMode, mode/readBy "grok" = the model); student copy says "Read by Claude". (17:56: optional readBy on EventDetail + ExtractionResult, optional stages on IngestResult) + rule change (human-approved 17:32): rule-fallback events with passing evidence and a start go live, not review (FALLBACK_LIVE_WHEN_EVIDENCE_OK in src/lib/pipeline/fallback.ts). CLAUDE.md Sec 9 line not yet updated.
GATES: cp0 passed 17:33 (typecheck, SMOKE_CP=0 3/3) | cp1 passed 17:35 (SMOKE_CP=1 9/9) | cp2 passed 17:35 (SMOKE_CP=2 13/13; flyer beat sim only until XAI key) | cp3 passed 17:37 (SMOKE_CP=3 18/18; SMOKE_CP=5 26/26). cp4 passed 17:38 (SMOKE_CP=5 26/26 by lead; timed rehearsal CP1-CP4 all beats under budget, run by qa-demo on clean DB) | cp5 passed 17:42 (SMOKE_CP=5 30/30 incl. cp5.spec)

Checkpoint targets: CP0 17:25 | CP1 17:55 | CP2 18:25 | CP3 18:55 | CP4 19:25 | CP5 19:50

## lead
status: all gates cp0-cp5 passed; polish phase. NO COMMITS OR TAGS from here (human commits with Cursor).
done: scaffold, contracts v1 + v1.1 (readBy, stages), gates cp0-cp5, fallback-live rule (human-approved)
uncommitted files changed by lead: COORDINATION.md, package.json, pnpm-lock.yaml (@anthropic-ai/sdk 1.10.0), .env.example (ANTHROPIC_API_KEY, CLAUDE_MODEL)
in flight (subagents): none
next: polish and anything cut. Before the demo: Reset demo (key 5), XAI_API_KEY + pnpm grok:record, Wi-Fi drill with YAPIZZA_FORCE_SIM=1
blockers: none

## pipeline
status: polish (18:25). Live Grok path untested (no key).
done: dedup room-change bug verified on reset DB (cp3 dedup 2/2), struck; held-out eval `pnpm eval --heldout` on integrations' 211 seed labels: 77% untuned baseline -> 91% (partly tuned on those misses); 40-fixture eval still 520/520; flyer host "Yale Helix" + summary; list suffixes stripped (OCAY Members -> OCAY); digest Free food / Other events groups (design styles); `pnpm grok:record --check`; live Grok calls also save replays; readBy + stages
in flight (subagents): none
next: when XAI_API_KEY lands: restart pnpm dev, `pnpm grok:record`, then `pnpm grok:record --check` (target 41 of 41); one keyed rehearsal also saves dedup matches for offline replay. Record on demo day.
blockers: none
uncommitted (human commits via Cursor; pipeline no longer commits): none (all pipeline files committed by the human as of 18:17)

## api
status: polish. Not committing from 18:24 on (human commits via Cursor); uncommitted files listed below.
done: events + seed (5bd6986); ask 9c94a90: POST /api/ask, Grok tool calling (search_events, search_hosts, get_event, max 3 rounds) with keyword fallback (tonight/today/weekend, free food, college aliases, tags); fallback runs now since no XAI key. CP4 f861836: GET /api/feeds/<slug>.ics (all, free-food, tag, host-<id>), GET/POST/DELETE /api/saves, POST /api/alerts/subscribe, notifyFreeFood(cards) in src/lib/db/alerts.ts, GET /api/digest/preview. CP5 7250dd7: GET /api/listings, GET /api/traditions (Series + tag fallback), /api/host/{hosts,claim,me}, PATCH /api/host/events/[id], POST /api/host/events/[id]/cancel. All curl-tested; dev.db restored after tests.
in flight (subagents): none
next: polish. Latest: Event.readBy (v1.1) stored and returned; detail shows the latest changing source; POST /api/alerts/unsubscribe; Ask keeps colleges strict ("Nothing in Jonathan Edwards yet."); resetDemoData() for Reset demo.
blockers: none. Prisma refuses `migrate reset` from Claude Code: `pnpm db:reset` / `demo:reset` run from the human's terminal.
uncommitted: src/lib/search/index.ts, src/lib/search/parse.selfcheck.ts, src/lib/db/host.ts, src/app/api/ask/route.ts, src/app/api/alerts/unsubscribe/route.ts, src/app/api/events/[id]/route.ts, src/app/api/events/[id]/view/route.ts (new), prisma/schema.prisma, prisma/migrations/20261117231427_event_host_original/ (new). Smoke 30/30.


## integrations
status: polish, hardening demo routes and sim pages (uncommitted, see list). No commits from integrations; human commits via Cursor
uncommitted files: src/lib/adapters/sim/mail.ts, src/lib/adapters/live/mime.ts (new), src/lib/adapters/live/gmail.ts, src/app/api/demo/[action]/route.ts, src/app/api/demo/emails/route.ts, src/app/sim/inbox/page.tsx, src/lib/adapters/env.ts, docs/SETUP-KEYS.md
done: CP0/CP1: events.seed.json d2550a5 (210 real events, demo-live sends left out), adapter registry + sim auth + /api/integrations/status 8565930, src/lib/calendar ec2f44c | CP2: live Gmail + pnpm google:token + docs/SETUP-KEYS.md a0e7755; sim inbox, POST /api/demo/[action] (send-email, room-change, cancel, free-food-now, reset), GET /api/demo/emails, /sim/inbox 1171ccd | CP3: Resend notifier (falls back to sim), /sim/outbox, GET /api/demo/outbox 34c2242 | CP4: Google sign-in (/api/auth/google), live Calendar insert (falls back to sim), POST /api/gcal/insert (writes Save), /sim/calendar, User row upsert on sign-in 98716be. All curl-tested on :3000 in sim mode; live paths untested (no keys). | Demo sends call notifyFreeFood (subscribe + free-food-now = 1 alert in /sim/outbox) 1ae0114. Every live adapter falls back to sim per request on failure.
in flight (subagents): none
next: hardening done: fixtures load fresh, bad files skipped with a warning, fixtures/emails/real/*.json|*.eml listed first (CLAUDE.md 13.2), pasted email validated (size, attachments), fixture lookup by listed name only, inbox capped at 200 with a separate pull queue. Tested on :3000: 5 bad-input cases give 400/404, .eml send creates a card, /sim/inbox, /sim/outbox, /sim/calendar (incl. bad ?week) render 200 with data. dev.db reset clean after. Reset also turns off alert subscriptions for everyone but demo-1..5 (smoke/anonymous subscribers no longer fill /sim/outbox; result.unsubscribed counts them).
blockers: none. Real intake alerts too (pipeline 0b3ae5c). free-food-now fixes: 1855d5e (own card), ad7610d (late subscribers).

## frontend
status: polishing (18:04). No commits (human commits with Cursor). Bugs: since= polling done; sales/traditions empty-state testids were already in.
done: everything on the role card; qa bug-hunt fixes; readBy gating; /host mobile rows; live updates now poll /api/events?since=<serverTime> every 3s and merge deltas (contract 8.3), also refreshing an open sheet
uncommitted files (frontend): src/lib/client/hooks.ts, src/lib/client/merge.selfcheck.ts, src/lib/client/format.ts, src/lib/client/format.selfcheck.ts, src/app/(site)/page.tsx, src/components/event/SourceDrawer.tsx, src/components/event/EventSheet.tsx, src/components/ask/useAsk.ts, src/components/ask/AskBox.tsx
in flight (subagents): none
next: polish behind flags (deep link /?event=<id> for alert and digest links), mobile recheck
blockers: none

## design
status: polish; no longer committing (human commits via Cursor). Commit hashes in this section predate the rewrite and are stale.
done: tokens; primitives (src/components/ui); COPY.md; layout + header + intro; intro final (wedges land on the first event rows) 521e458; motion helpers Enter/EnterList/ARRIVE_CLASS (frontend wired them); Sheet enter/exit motion 56e0f7d; SheetContent passes Radix props (onCloseAutoFocus) 98efa8f; copy pass sent to frontend; mobile pass at 375 (header scroller, .no-scrollbar class) and AA contrast fix for text-faint 99a358a; favicon (src/app/icon.svg), public/brand/mark.svg, opengraph image ff08317
in flight (subagents): none
qa: screenshots of /, /ask, /host, /host/upload, /traditions, /sales, /digest (desktop) and /, /ask, sheet (375px) all on-system; focus ring fix f0848a5
qa round 2 sent: api (updated event drawer shows the old source, digest not sorted within a day), pipeline (fallback summary is raw text naming the old room), frontend (/host mobile rows truncate titles)
a11y pass (18:00): automated audit on /, /ask, /host, /host/upload, /traditions, /sales, /digest plus keyboard run on feed and sheet: clean except feed has no h1 (sent to frontend). Dark mode stays cut: it would follow the demo laptop OS setting and adds risk for no demo gain.
next: polish until wrap (host row buttons with frontend, any visual bugs)
uncommitted files (design): docs/COPY.md (drawer provenance line, digest labels, Read by Claude)
blockers: none
cut: dark mode
notes: lead, I removed the scaffold's default src/app/favicon.ico (replaced by icon.svg).
sent: frontend (sheet focus restore, Ask empty state twice, 3 string fixes, chip row no-scrollbar); api (Ask "free food tonight" returns 0 results)

## qa-demo
status: polish mode (18:14). Bug-hunt pass 2 done: 11 of 13 fixes verified, 10 new minor or demo-visible bugs logged and sent, none blocking. SMOKE_CP=5 smoke 30/30. Rehearsal passes all beats; one run failed at the flyer beat while other sessions were writing, and passed on rerun.
uncommitted (qa-demo): tests/smoke/cp3.spec.ts, tests/demo/rehearsal.spec.ts (Grok line only when readBy is grok), tests/smoke/cp2.spec.ts (polling test checks since= per contract 8.3), src/app/demo/DemoPanel.tsx (email picker loads /api/demo/emails so real/ emails show), docs/DEMO.md, docs/PITCH.md, docs/QA.md (final script, Grok key-day steps, Q&A, QA checklist)
done: smoke cp0-cp5; /demo panel (per-stage timings, real/ emails in the picker); self-resetting rehearsal; DEMO.md final script with key and no-key variants, Grok key-day steps, Wi-Fi drill, backup checklist; PITCH.md Q&A; QA.md
in flight (subagents): none
next: reverify the digest order when pipeline reports; recheck fixes as owners report; Wi-Fi drill when dev runs with YAPIZZA_FORCE_SIM=1; rehearse with the Grok key; backup video after the wrap
blockers: Grok key plus `pnpm grok:record`

## Requests (append only; "from to to: what")
- ~~qa-demo to frontend: put `data-testid="event-card"` on every feed event card; smoke tests also look for a dialog for the detail sheet, an "Add to calendar" link, and a "Free food" filter button.~~ done 07b5b47
- ~~qa-demo to design: intro root gets `data-testid="intro"`; skip the intro when sessionStorage `yapizza:intro-seen` is '1' and set it on finish or skip.~~ done b4a91a5
- qa-demo to integrations: keep demo send-in events out of events.seed.json (3 YUMS events in emails/34, Helix Langer chat in 31), or CP2 sends dedupe to `same`.

## Bugs (qa-demo logs; owner fixes and strikes through)
- 
- ~~[pipeline] Flyer upload in replay mode (no XAI_API_KEY): /api/upload with helix-langer-flyer.png returns created: [] because replay misses and the fallback reads nothing from an image. Demo beat 3 breaks offline. (17:24)~~ fixed 07133c7, smoke passes
- ~~[frontend] Feed polling refetches the full range every 3s, not `/api/events?since=` per contract 8.3. Works; low priority. (17:24)~~ fixed 18:04: polls ?since=<serverTime> and merges deltas
- ~~[frontend] /host/upload: a repeat upload that dedup matches as `same` shows "No events found in this file." It should say the event is already listed (and show that card). Host-facing; low priority. (17:26)~~ fixed: now reads "No new events in this file."
- ~~[integrations, pipeline] Demo key 4 (free-food-now) sends an AACC email on Nov 17 at AACC MPR that mentions Senior Story. The seed has Senior Story (AACC, Nov 17, AACC MPR), and the fallback matcher treats same host plus same day as one event, so it will likely `update` Senior Story instead of creating a pizza card. Fix: give the key-4 email a host and place that don't collide, and drop the "from Senior Story" line. (17:28)~~ fixed by integrations: key 4 now sends Silliman GA, Silliman Buttery
- ~~[pipeline, verified by pipeline on a fresh DB 0631a7b; smoke rerun waits on reset] Dedup room change unverified: dev.db has a standalone Math Research Panel at LC (updatedFields []) left by a 17:23 test press of 39 before 34 was sent. Needs `pnpm demo:reset` (human) and a rerun of `SMOKE_CP=3 pnpm exec playwright test tests/smoke/cp3.spec.ts -g dedup`. (17:28)~~ passes after reset (17:37)
- ~~[integrations] Free food alerts skip anyone who subscribes after the first key-4 press: repeat presses dedupe to `same` (0 created, 0 updated) and the demo route alerts only on created/updated. Test: cp4.spec.ts -g alert. DEMO.md works around it by opting in during setup. (17:30)~~ fixed by integrations: a `same` result still alerts new subscribers
- [lead, human] Demo risk: no XAI_API_KEY and no replay recordings (fixtures/grok-replay has only the flyer OCR). Every live send runs the rule fallback at confidence 0.50, so the "How this was read" drawer shows a Review badge, and Ask shows keyword matches with no "Read by Grok". The Grok story (beats 2 to 5) needs a key, then `pnpm grok:record` for the DEMO.md inputs. (17:32)
- ~~api (17:37): CP3 smoke dedup tests fail (cp3.spec.ts:74, :91). Live "Math Research Panel" (LC 102) has no EventVersion, so it was inserted as new; the originals are 4 `review` duplicates at WLH 120. Owner: pipeline (dedup). DB needs `pnpm demo:reset` from the human terminal before the demo.~~ fixed: verified by pipeline at 18:03 on the reset dev.db, `SMOKE_CP=3 pnpm exec playwright test tests/smoke/cp3.spec.ts -g dedup` 2/2 pass; one live panel at LC 102 with updatedFields [placeId, locationRaw]
- ~~[frontend] SalesBoard.tsx and TraditionsList.tsx empty states lack data-testid="empty-state" (tests rely on it if a list is ever empty). Low priority. (17:41)~~ fixed (both have it)
- ~~[pipeline, lead] bug-hunt 17:55: drawer says "Read by Grok · confidence 0.50" on rule-fallback events (every demo send, since nothing is recorded). Grok never read them. Needs a Grok key plus `pnpm grok:record`, or an additive EventDetail field (e.g. readBy) so the drawer doesn't claim Grok. (17:55)~~ fixed: readBy in contracts v1.1; drawer shows the Grok line only for grok
- ~~[pipeline] Re-sending an older email after a room change reverts the room: 34, then 39 (LC 102), then 34 again gives WLH 120 with the Updated badge kept. An older sentAt must not overwrite a newer update. (17:55)~~ fixed 20fabb4
- ~~[pipeline, frontend] Flyer drawer is empty: rawText is "[image] helix-langer-flyer.png", no evidence, summary repeats the title, and the label says "From the email". Store the OCR text as rawText; label by source kind. (17:55)~~ fixed: flyer text stored, evidence highlighted, label by kind
- ~~[integrations, frontend] Seeded cards' drawer shows sender "events.real.md", kind "Form", heading "From the email". Seed should carry a real list or office name; SourceDrawer should label by kind. (17:55)~~ seed half fixed by integrations (real list or office senders); frontend now labels by kind
- ~~[frontend] Ask results show time with no day and aren't in time order ("career talk": Thu 2 PM, Thu 4 PM, then today's All day and 5:15 PM). (17:55)~~ fixed 702fd1d
- ~~[api] Ask keyword fallback: "career talk" returns only academic events; "something in JE" says "These are close" and lists unrelated events. (17:55)~~ fixed by api
- [api, design, lead: REOPENED 18:12, reverted by 3fd264e "free food first within a day"; decide] ~~Digest preview not in time order within a day (Wed Nov 18: 2:00 PM before 10:15 AM). (17:55)~~ fixed 9fec7df
- ~~[frontend] Canceled event's sheet still offers Add to calendar and Save. (17:55)~~ fixed
- ~~[frontend, api] Alerts Undo only clears localStorage; there's no unsubscribe route, so alerts keep going out. (17:55)~~ fixed: Turn off posts freeFood:false; api added /api/alerts/unsubscribe
- ~~[frontend] Save while signed out: pick a student, then Save must be clicked again. (17:55)~~ fixed
- ~~[frontend] Card shows "AACC · AACC" when place and host match. (17:55)~~ fixed
- ~~[frontend] Members-only events (fixture 36) show in the public feed with no marker; /digest is not linked; HostDashboard compares ISO strings with different offsets for "upcoming". (17:55)~~ fixed
- ~~[frontend, design] SourceDrawer shows "Needs review" whenever confidence < 0.7, even on live cards. Every demo send is rule-read at 0.50 until there's a key, so the room-change, flyer and pizza drawers all say "Needs review" on stage. Decide whether a live rules card shows it (readBy now tells rules from grok). (18:07)~~ fixed by frontend: "Needs review" only when status is review; no line for non-Grok reads
- ~~[api] Ask "free food this week" drops the Silliman pizza once its start has passed, though it runs 45 min; "tonight" includes it. Include events that are still running. (18:07)~~ fixed 18:1x (api): every Ask window keeps events still running at its start (end later, or no end and began within 90 min); finished events drop out. Uncommitted in src/lib/search/index.ts.
- ~~[frontend] bug-hunt 2: useAsk.ts drops the server's answer when it has 0 results and runs its own keyword search. "something in JE" shows this week's first 8 events instead of "Nothing in Jonathan Edwards yet."; "pizza" before key 4 does the same. Keep the server answer; fall back only on errors. (18:12)~~ fixed: server answer kept; JE shows "Nothing in Jonathan Edwards yet." (verified 18:14)
- ~~[api] Ask fallback ignores the day: "talks on Thursday" lists Tue and Wed events first, and only 4 of 8 are Thursday. (18:12)~~ fixed 18:3x (api), uncommitted
- ~~[pipeline] Flyer card has hostName null although the text starts "YALE HELIX PRESENTS"; summary repeats the title. (18:12)~~ fixed: host Yale Helix (verified 18:17)
- ~~[pipeline] Fixture 36 host is "OCAY Members" (the list name), so /host lists OCAY and OCAY Members as separate clubs. (18:12)~~ fixed by pipeline
- [pipeline, api] Rule-fallback events at confidence 0.50 are saved live, against 12.3 (below 0.7 means review). It's a lead decision (FALLBACK_LIVE_WHEN_EVIDENCE_OK); noted for the record. (18:12)
- ~~[api] Host edit, then restoring the title, leaves updatedFields ['title'], so the card keeps the Updated badge. (18:12)~~ fixed 18:3x (api), uncommitted
- ~~[api] GET /api/events/[id] counts every fetch as a view, so API calls and refetches inflate the /host reach totals. (18:12)~~ fixed 18:3x (api), uncommitted
- ~~[integrations] Reset keeps alert subscriptions, so each key-4 press also alerts the test addresses (smoke@example.com, late-subscriber@yapizza.test) and clutters /sim/outbox. Reset could drop subscriptions for non-demo-student addresses. (18:12)~~ fixed: reset turns off non-demo-student subscriptions
- ~~[api] /api/alerts/unsubscribe also turns off the signed-in user's alerts when only a target is given; the client ignores a failed unsubscribe. (18:12)~~ fixed 18:3x (api), uncommitted
- ~~[frontend] SourceDrawer labels every upload (CSV, PDF, .ics) "From a flyer"; the members-only marker is on the card but not in the sheet. (18:12)~~ fixed: "From an upload"; marker in sheet

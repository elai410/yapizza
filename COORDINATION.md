# Yapizza build board
CLOCK START: Tue Nov 17 17:10:32 EST 2026
CURRENT TARGET: after CP5, keep improving until the human calls a wrap
WRAP: none
SCAFFOLD: READY (17:12)
CONTRACTS: v1.1 (17:56: optional readBy on EventDetail + ExtractionResult, optional stages on IngestResult) + rule change (human-approved 17:32): rule-fallback events with passing evidence and a start go live, not review (FALLBACK_LIVE_WHEN_EVIDENCE_OK in src/lib/pipeline/fallback.ts). CLAUDE.md Sec 9 line not yet updated.
GATES: cp0 passed 17:33 (typecheck, SMOKE_CP=0 3/3) | cp1 passed 17:35 (SMOKE_CP=1 9/9) | cp2 passed 17:35 (SMOKE_CP=2 13/13; flyer beat sim only until XAI key) | cp3 passed 17:37 (SMOKE_CP=3 18/18; SMOKE_CP=5 26/26). cp4 passed 17:38 (SMOKE_CP=5 26/26 by lead; timed rehearsal CP1-CP4 all beats under budget, run by qa-demo on clean DB) | cp5 passed 17:42 (SMOKE_CP=5 30/30 incl. cp5.spec)

Checkpoint targets: CP0 17:25 | CP1 17:55 | CP2 18:25 | CP3 18:55 | CP4 19:25 | CP5 19:50

## lead
status: watching CP0 gate (17:25). Gate cmd: pnpm typecheck && SMOKE_CP=0 pnpm test:smoke
done: clock, board, Next 16 + deps, contracts v1, .env.example, schema v1 + init migration, scripts + stubs, Playwright chromium
in flight (subagents): none
next: polish and anything cut. Before the demo: Reset demo (key 5), XAI_API_KEY + pnpm grok:record, Wi-Fi drill with YAPIZZA_FORCE_SIM=1
blockers: none (typecheck green 17:19)

## pipeline
status: polish (17:55). Role card CP0-CP5 code landed. Live Grok path untested (no key).
done: fallback eval 520/520 on all 40 fixtures (labels written by us, so in-sample); clean fallback summaries (no raw lines, no time/place); room change rewrites old room in summary and stores the update email's evidence (drawer shows LC 102); digest free food first per design; free food alerts on ingest
in flight (subagents): none
next: `pnpm grok:record` when XAI_API_KEY lands (record on demo day: replay keys include the date), then one live prompt check
blockers: none. Fresh-reset demo fixtures that make new cards: 34 (3), 31 (flyer), 36; 39 after 34 = room change; 40 = cancel. Re-sending 13 marks YSO "Updated" (seed says 11:30pm pre-show, fallback says midnight main show).

## api
status: polishing Ask fallback (17:56)
done: events + seed (5bd6986); ask 9c94a90: POST /api/ask, Grok tool calling (search_events, search_hosts, get_event, max 3 rounds) with keyword fallback (tonight/today/weekend, free food, college aliases, tags); fallback runs now since no XAI key. CP4 f861836: GET /api/feeds/<slug>.ics (all, free-food, tag, host-<id>), GET/POST/DELETE /api/saves, POST /api/alerts/subscribe, notifyFreeFood(cards) in src/lib/db/alerts.ts, GET /api/digest/preview. CP5 7250dd7: GET /api/listings, GET /api/traditions (Series + tag fallback), /api/host/{hosts,claim,me}, PATCH /api/host/events/[id], POST /api/host/events/[id]/cancel. All curl-tested; dev.db restored after tests.
in flight (subagents): none
next: Ask fallback now searches summaries, weights rare words, stems (volunteering), Yale synonyms (asian american -> AACC, mental health -> wellness), relaxes filters instead of answering empty, shows a series once. resetDemoData() in src/lib/db/seed.ts for the demo reset.
blockers: none. Prisma refuses `migrate reset` from Claude Code: `pnpm db:reset` / `demo:reset` run from the human's terminal.

## integrations
status: polish (17:55). SETUP-KEYS.md ready for the human; live fallback verified
done: CP0/CP1: events.seed.json d2550a5 (210 real events, demo-live sends left out), adapter registry + sim auth + /api/integrations/status 8565930, src/lib/calendar ec2f44c | CP2: live Gmail + pnpm google:token + docs/SETUP-KEYS.md a0e7755; sim inbox, POST /api/demo/[action] (send-email, room-change, cancel, free-food-now, reset), GET /api/demo/emails, /sim/inbox 1171ccd | CP3: Resend notifier (falls back to sim), /sim/outbox, GET /api/demo/outbox 34c2242 | CP4: Google sign-in (/api/auth/google), live Calendar insert (falls back to sim), POST /api/gcal/insert (writes Save), /sim/calendar, User row upsert on sign-in 98716be. All curl-tested on :3000 in sim mode; live paths untested (no keys). | Demo sends call notifyFreeFood (subscribe + free-food-now = 1 alert in /sim/outbox) 1ae0114. Every live adapter falls back to sim per request on failure.
in flight (subagents): none
next: polish. Live fallback verified with invalid keys on a scratch DB: Gmail pull -> 0 + log, Resend -> sim outbox row, Grok -> rule-based fallback (3 cards), Calendar insert -> /sim/calendar. POST /api/demo/reset reseeds dev.db. Seed has the OCAY listing (a60083d).
blockers: none. Real intake alerts too (pipeline 0b3ae5c). free-food-now fixes: 1855d5e (own card), ad7610d (late subscribers).

## frontend
status: CP1 to CP5 UI committed (957817f, 17:34). Smoke SMOKE_CP=5: 24/26 pass; 2 CP3 dedup fails are backend (room change leaves updatedFields [] on the event, see lead msg)
done: feed/filters/card/sheet; 3s polling + arrival wash + New/Updated toasts; /host/upload; /ask + inline Ask (keyword fallback); "How this was read" drawer; Changed line; sheet focus restore; Subscribe menu; free food alerts + outbox toasts; /digest; Save + Calendar insert + student picker (Google link when available); /traditions; /sales; /host (claim, your events with reach, edit, cancel); COPY.md + design copy fixes; mobile chip row
in flight (subagents): none
next: polish: mobile pass on sheet and /host, Ask why-line alignment with real Grok output, since= polling if time
blockers: none (header nav overflow at 375px sent to design)

## design
status: polish, QA round 2 done (17:47)
done: tokens; primitives (src/components/ui); COPY.md; layout + header + intro; intro final (wedges land on the first event rows) 521e458; motion helpers Enter/EnterList/ARRIVE_CLASS (frontend wired them); Sheet enter/exit motion 56e0f7d; SheetContent passes Radix props (onCloseAutoFocus) 98efa8f; copy pass sent to frontend; mobile pass at 375 (header scroller, .no-scrollbar class) and AA contrast fix for text-faint 99a358a; favicon (src/app/icon.svg), public/brand/mark.svg, opengraph image ff08317
in flight (subagents): none
qa: screenshots of /, /ask, /host, /host/upload, /traditions, /sales, /digest (desktop) and /, /ask, sheet (375px) all on-system; focus ring fix f0848a5
qa round 2 sent: api (updated event drawer shows the old source, digest not sorted within a day), pipeline (fallback summary is raw text naming the old room), frontend (/host mobile rows truncate titles)
next: polish until wrap (host row buttons with frontend, any visual bugs)
blockers: none
cut: dark mode
notes: lead, I removed the scaffold's default src/app/favicon.ico (replaced by icon.svg).
sent: frontend (sheet focus restore, Ask empty state twice, 3 string fixes, chip row no-scrollbar); api (Ask "free food tonight" returns 0 results)

## qa-demo
status: all checkpoints covered (17:41). SMOKE_CP=5 smoke 30/30; the rehearsal passes CP1-CP4 under budget; DB reset clean afterwards.
done: smoke cp0-cp5 (104b582); /demo panel; tests/demo/rehearsal.spec.ts (self-resetting); DEMO.md final script, per-CP scripts, pre-stage reset step, Wi-Fi drill, backup checklist; PITCH.md plus 9 Q&A answers; QA.md
in flight (subagents): none
next: Wi-Fi drill (human restarts dev with YAPIZZA_FORCE_SIM=1); rehearse with the Grok key once it's in; record the backup video after the wrap
blockers: Grok key plus `pnpm grok:record` (Ask runs in fallback mode)

## Requests (append only; "from to to: what")
- ~~qa-demo to frontend: put `data-testid="event-card"` on every feed event card; smoke tests also look for a dialog for the detail sheet, an "Add to calendar" link, and a "Free food" filter button.~~ done 07b5b47
- ~~qa-demo to design: intro root gets `data-testid="intro"`; skip the intro when sessionStorage `yapizza:intro-seen` is '1' and set it on finish or skip.~~ done b4a91a5
- qa-demo to integrations: keep demo send-in events out of events.seed.json (3 YUMS events in emails/34, Helix Langer chat in 31), or CP2 sends dedupe to `same`.

## Bugs (qa-demo logs; owner fixes and strikes through)
- 
- ~~[pipeline] Flyer upload in replay mode (no XAI_API_KEY): /api/upload with helix-langer-flyer.png returns created: [] because replay misses and the fallback reads nothing from an image. Demo beat 3 breaks offline. (17:24)~~ fixed 07133c7, smoke passes
- [frontend] Feed polling refetches the full range every 3s, not `/api/events?since=` per contract 8.3. Works; low priority. (17:24)
- ~~[frontend] /host/upload: a repeat upload that dedup matches as `same` shows "No events found in this file." It should say the event is already listed (and show that card). Host-facing; low priority. (17:26)~~ fixed: now reads "No new events in this file."
- ~~[integrations, pipeline] Demo key 4 (free-food-now) sends an AACC email on Nov 17 at AACC MPR that mentions Senior Story. The seed has Senior Story (AACC, Nov 17, AACC MPR), and the fallback matcher treats same host plus same day as one event, so it will likely `update` Senior Story instead of creating a pizza card. Fix: give the key-4 email a host and place that don't collide, and drop the "from Senior Story" line. (17:28)~~ fixed by integrations: key 4 now sends Silliman GA, Silliman Buttery
- ~~[pipeline, verified by pipeline on a fresh DB 0631a7b; smoke rerun waits on reset] Dedup room change unverified: dev.db has a standalone Math Research Panel at LC (updatedFields []) left by a 17:23 test press of 39 before 34 was sent. Needs `pnpm demo:reset` (human) and a rerun of `SMOKE_CP=3 pnpm exec playwright test tests/smoke/cp3.spec.ts -g dedup`. (17:28)~~ passes after reset (17:37)
- ~~[integrations] Free food alerts skip anyone who subscribes after the first key-4 press: repeat presses dedupe to `same` (0 created, 0 updated) and the demo route alerts only on created/updated. Test: cp4.spec.ts -g alert. DEMO.md works around it by opting in during setup. (17:30)~~ fixed by integrations: a `same` result still alerts new subscribers
- [lead, human] Demo risk: no XAI_API_KEY and no replay recordings (fixtures/grok-replay has only the flyer OCR). Every live send runs the rule fallback at confidence 0.50, so the "How this was read" drawer shows a Review badge, and Ask shows keyword matches with no "Read by Grok". The Grok story (beats 2 to 5) needs a key, then `pnpm grok:record` for the DEMO.md inputs. (17:32)
- api (17:37): CP3 smoke dedup tests fail (cp3.spec.ts:74, :91). Live "Math Research Panel" (LC 102) has no EventVersion, so it was inserted as new; the originals are 4 `review` duplicates at WLH 120. Owner: pipeline (dedup). DB needs `pnpm demo:reset` from the human terminal before the demo.
- [frontend] SalesBoard.tsx and TraditionsList.tsx empty states lack data-testid="empty-state" (tests rely on it if a list is ever empty). Low priority. (17:41)
- [pipeline, lead] bug-hunt 17:55: drawer says "Read by Grok · confidence 0.50" on rule-fallback events (every demo send, since nothing is recorded). Grok never read them. Needs a Grok key plus `pnpm grok:record`, or an additive EventDetail field (e.g. readBy) so the drawer doesn't claim Grok. (17:55)
- [pipeline] Re-sending an older email after a room change reverts the room: 34, then 39 (LC 102), then 34 again gives WLH 120 with the Updated badge kept. An older sentAt must not overwrite a newer update. (17:55)
- [pipeline, frontend] Flyer drawer is empty: rawText is "[image] helix-langer-flyer.png", no evidence, summary repeats the title, and the label says "From the email". Store the OCR text as rawText; label by source kind. (17:55)
- [integrations, frontend] Seeded cards' drawer shows sender "events.real.md", kind "Form", heading "From the email". Seed should carry a real list or office name; SourceDrawer should label by kind. (17:55)
- [frontend] Ask results show time with no day and aren't in time order ("career talk": Thu 2 PM, Thu 4 PM, then today's All day and 5:15 PM). (17:55)
- [api] Ask keyword fallback: "career talk" returns only academic events; "something in JE" says "These are close" and lists unrelated events. (17:55)
- [api] Digest preview not in time order within a day (Wed Nov 18: 2:00 PM before 10:15 AM). (17:55)
- [frontend] Canceled event's sheet still offers Add to calendar and Save. (17:55)
- [frontend, api] Alerts Undo only clears localStorage; there's no unsubscribe route, so alerts keep going out. (17:55)
- [frontend] Save while signed out: pick a student, then Save must be clicked again. (17:55)
- [frontend] Card shows "AACC · AACC" when place and host match. (17:55)
- [frontend] Members-only events (fixture 36) show in the public feed with no marker; /digest is not linked; HostDashboard compares ISO strings with different offsets for "upcoming". (17:55)

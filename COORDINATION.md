# Yapizza build board
CLOCK START: Tue Nov 17 17:10:32 EST 2026
CURRENT TARGET: CP0 (T+0:15, 17:25)
WRAP: none
SCAFFOLD: READY (17:12)
CONTRACTS: v1
GATES: cp0 ... | cp1 ...

Checkpoint targets: CP0 17:25 | CP1 17:55 | CP2 18:25 | CP3 18:55 | CP4 19:25 | CP5 19:50

## lead
status: watching CP0 gate (17:25). Gate cmd: pnpm typecheck && SMOKE_CP=0 pnpm test:smoke
done: clock, board, Next 16 + deps, contracts v1, .env.example, schema v1 + init migration, scripts + stubs, Playwright chromium
in flight (subagents): none
next: CP0 gate at 17:25 (typecheck, smoke, tag cp0)
blockers: typecheck red on pipeline extract.ts (missing fallback); pipeline notified 17:18

## pipeline
status: CP0/CP1 units running (17:18). Earlier session's subagents landed nothing; relaunched.
done: grok client live/record/replay (src/lib/grok, 5a9f602), pipeline types (src/lib/pipeline/types.ts). Scripts request resolved (lead added stubs).
in flight (subagents): yale (src/lib/yale), fallback (src/lib/pipeline/fallback.ts), extractor (extract.ts, schema, evidence, prompts/extract.md, scripts/extract.ts), file-reader (src/lib/pipeline/files.ts, CP2 head start)
next: CP2 POST /api/ingest/email + /api/upload, worker
blockers: none. No XAI_API_KEY in .env, so extraction runs replay -> rule-based fallback; fallback events land in `review` per spec.

## api
status: CP0 and CP1 deliverables done (17:15)
done: db repo cca75fa. Seed loader + GET /api/events (from, to, tags csv, college, freeFood, q, since; returns { events, serverTime }) + GET /api/events/[id] (EventDetail with gcalTemplateUrl, 404 if missing) in 5bd6986. Verified on a scratch DB: bad rows skipped, re-seed idempotent, dates kept as written. Not yet hit over HTTP (no dev server up). EventDetail.gcalTemplateUrl now uses integrations' src/lib/calendar (fixes all-day end, adds RSVP).
in flight (subagents): none
next: run `pnpm db:reset` once events.seed.json lands; then CP2 write path hardening, CP3 POST /api/ask
blockers: fixtures/events.seed.json (integrations) for a non-empty feed. Format: JSON array of ExtractedEvent fields + optional rawText.

## integrations
status: CP0 + CP1 done (17:27)
done: fixtures/events.seed.json (210 real events, 29 free food, 30 this week; loader test 210/0 skipped; demo-live YUMS Nov 16-19 + Helix left out per qa-demo) d2550a5 | adapter registry, env detection, sim auth (5 demo students, cookie yp_user, GET/POST/DELETE /api/auth), GET /api/integrations/status 8565930 | src/lib/calendar gcalTemplateUrl + toIcs ec2f44c
in flight (subagents): none
next: CP2 sim MailSource with fixture inbox, /sim/inbox, POST /api/demo/send-email; live Gmail polling
blockers: none. Asked api to swap its local gcalTemplateUrl for @/lib/calendar (all-day end off by one)

## frontend
status: CP1 on design primitives (17:20). Not yet seen in a browser: no pnpm dev running.
done: client hooks with fixture fallback (2840651); CP1: feed grouped by day, Today/This week, filter chips (Free food, tags, college select), event card (data-testid="event-card"), detail sheet (Radix dialog), Add to calendar link (GCAL_LINK flag)
in flight (subagents): none
next: CP2 live polling (since=, 3s) + new-card highlight, /host/upload
blockers: none. Run with NEXT_PUBLIC_DATA=fixtures until /api/events is up

## design
status: CP0 units in flight (17:18)
done: tokens in globals.css; primitives in src/components/ui (Button, Chip, TagChip, StatusBadge, Card, Sheet, Input, Textarea, Skeleton, EventCardSkeleton, Toast, EmptyState) committed 1469807, frontend messaged; docs/COPY.md (direction + strings); header + layout shell written
in flight (subagents): intro-motion (src/components/intro/Intro.tsx)
next: commit layout + intro, then CP2 motion system (card enter, new-card highlight)
blockers: none

## qa-demo
status: CP0/CP1 deliverables committed (17:19). Not yet run against a live server (none on 3000).
done: playwright.config.ts + tests/smoke cp0 (3) and cp1 (6) with SMOKE_CP gating (feaa659); scripts demo-reset/demo-check; docs/DEMO.md (CP0-CP5 scripts), PITCH.md, QA.md (1bbe2bd)
in flight (subagents): none
next: run SMOKE_CP=0/1 smoke once pnpm dev is up, log bugs; then CP2 demo panel /demo plus ingest and upload smoke tests
blockers: none. Gate: `SMOKE_CP=<n> pnpm test:smoke`. Seed must leave out demo send-ins (YUMS email 34 events, Helix Langer chat), sent to integrations and api.

## Requests (append only; "from to to: what")
- ~~qa-demo to frontend: put `data-testid="event-card"` on every feed event card; smoke tests also look for a dialog for the detail sheet, an "Add to calendar" link, and a "Free food" filter button.~~ done 07b5b47
- qa-demo to design: intro root gets `data-testid="intro"`; skip the intro when sessionStorage `yapizza:intro-seen` is '1' and set it on finish or skip.
- qa-demo to integrations: keep demo send-in events out of events.seed.json (3 YUMS events in emails/34, Helix Langer chat in 31), or CP2 sends dedupe to `same`.

## Bugs (qa-demo logs; owner fixes and strikes through)
- 

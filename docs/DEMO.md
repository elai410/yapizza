# Yapizza demo script

Owner: qa-demo. One script per checkpoint. Whatever checkpoint we wrap at, run that section. The full story runs 3:00 (CLAUDE.md 14.2). Demo day is Tue, Nov 17, 2026; every event below is real and comes from `fixtures/events.real.md` or `fixtures/emails/`.

## Setup checklist (5 minutes before)

- [ ] `pnpm dev` running on port 3000 in its own terminal. If .env changed since it started, restart it.
- [ ] Reset: on `/demo` press 5 (Reset demo) and confirm the dialog. It reseeds 210 events and 1 listing (the OCAY gear sale) in under a second and clears the sim inbox, outbox and calendar. Users and alert subscriptions are kept. If the app is down or the schema changed, run `pnpm demo:reset` in a plain terminal instead (Prisma refuses `migrate reset` from a Claude session).
- [ ] Browser tab 1: `http://localhost:3000/` in a fresh window, so the intro plays once.
- [ ] Browser tab 2: `http://localhost:3000/demo` (CP2 and later). Check the status row: which services are live, which are sim.
- [ ] CP4 and later: opt the demo student in to free food alerts on the feed's alerts card. Key 4 then alerts them. A repeat press of 4 makes no new card but still alerts anyone who opted in since.
- [ ] CP4 and later: phone on the same Wi-Fi, signed in to the demo Google account, Google Calendar app open.
- [ ] Bad Wi-Fi: follow the Wi-Fi failure drill below.
- [ ] Zoom the browser to 125% for the room.

Seed requirement (integrations, api): `fixtures/events.seed.json` must not already contain the events the demo sends in (the three events in `34-yums-weekly-nov-16.json` and the Helix Langer chat). Otherwise dedup marks them `same` and no card appears.

### Demo day: Claude API key

Today there is no `ANTHROPIC_API_KEY`, so every card is read by rules (`readBy: 'rules'`) and no drawer shows the Claude line. Once the human adds the key to `.env` and restarts `pnpm dev`:

1. `pnpm grok:record` records the 40 fixture emails and the flyer.
2. `pnpm grok:record --check` needs no key and prints "N of 41 inputs replay offline today". The target is 41 of 41. (Without a key today it prints 0 of 41.)
3. Run one full rehearsal with the key live. That also saves every live Claude call as replay, including the dedup match for the room change, so the `YAPIZZA_FORCE_SIM=1` drill afterwards replays the whole demo.

Key 4's email changes on every press, so offline it always runs on the rules. That's fine: it parses. Replays only work on the day they were recorded, so record on demo day.

---

**Last step before going on stage:** on `/demo` press 5 (Reset demo), confirm, and check that the log row reads "demo data reseeded". Then reload tab 1 in a new window so the intro plays. Alert opt-ins survive the reset. Do this after every rehearsal and after anyone runs `pnpm test:smoke`, since tests leave demo data behind.

## Final script (presenter version, 3:00)

Tab 1 is the feed, tab 2 is `/demo`, the phone is on the table. Keys are pressed on tab 2. Setup is done, including the free food alert opt-in.

| Time | Beat | Do | Say |
|---|---|---|---|
| 0:00 | Problem | Slide: a real Yale inbox full of unread club emails. | "This is a normal week of Yale email. The free dinner is in here somewhere." |
| 0:10 | Feed | Tab 1, This week. Click Free food, then click it again to clear. | "Everything open to Yale students this week, read from the emails clubs already send." |
| 0:25 | Club email | Tab 2, select `34`, press 1. Tab 1: Pset night, Putnam problem session and Math Research Panel appear with a highlight. | "One messy YUMS email, three events, in a few seconds." |
| 0:45 | Flyer | Tab 2, select `helix-langer-flyer.png`, press 3. Tab 1: Fireside Chat with Robert Langer, Fri, Nov 20 · 1:15 PM, LC 101. | "That was a photo of a flyer." |
| 1:05 | Room change | Tab 2, press 2. Tab 1: Math Research Panel now reads LC 102 with an Updated badge. Still one card. | "Same event, new room, no duplicate." |
| 1:20 | Free food now | Tab 2, press 4. Tab 1: Free pizza, Silliman Buttery, at the current time, plus the alert toast. | "A college posts free pizza, and students who opted in hear about it right away." |
| 1:35 | Ask | Tab 1, Ask box: "free food tonight", Enter. | See the two variants below. |
| 1:55 | Source | Open the Math Research Panel card, then How this was read. The drawer shows the ROOM CHANGE email, newest source first, with "LC 102" highlighted. | See the two variants below. |
| 2:20 | Calendar | Phone: open the Langer card, Add to calendar. | "One tap, and it's in the calendar students already use." |
| 2:35 | Host (optional, CP5) | Tab 1, `/host`: a club's events with reach totals. | "Clubs see how many people saved their event. Totals only, never names." |
| 2:50 | Close | Back to the feed. | "One address per club, and students never join another list." |

**Ask beat (1:35)**
- With Claude key: the answer is one or two sentences, the line under it reads "Read by Claude", and the Free pizza card comes first with a short why. Say: "Plain words in. Claude searches the events and we only show cards that exist."
- Without key: the line reads "Showing keyword matches." and the Free pizza card shows with "Free food: pizza · Tonight". Say: "Plain words in, events out. Offline it's keyword search, and the cards are the same."

**Source beat (1:55)**
- With Claude key: the drawer ends with "Read by Claude · confidence 0.9x". Say: "Every card keeps its source. The highlighted quotes are what Claude used, and code checks each one is really in the email."
- Without key: no Claude line and no review label (the rules read it, and the highlighted quotes passed the check). Say: "Claude reads these in production; offline it falls back to rules and still checks every quote." The drawer only says Claude read a card when Claude did.

Cuts: if CP5 did not land, drop the host beat and give the time to the close. `/traditions` and `/sales` are extras, only if a beat ran short. Ask cards show the day and time, sorted by start.

---

## CP0: Foundation

Story: the app boots and the intro sets up the idea. 0:20.

1. Open tab 1 in a fresh window. The intro plays: club email subject lines stream in, collapse into a circle, slice into wedges, and settle as the first row of cards. Under 2.5 seconds.
2. Say: "Every Yale club already sends email. We read it so students don't have to."
3. Reload the tab. The intro does not replay in the same session (sessionStorage `yapizza:intro-seen`).
4. Open a new window, load `/`, press any key during the intro. It skips at once.
5. The header shows the Yapizza wordmark. No errors in the page.

Check: with reduced motion on (macOS: Accessibility, Display, Reduce motion), the intro is a short fade.

---

## CP1: Static feed

Story: one calm page for everything happening at Yale this week. 1:00. Inputs: seeded events only.

1. (0:00) Tab 1 on `/`, This week. Say: "This is everything open to Yale students this week, read from club and office emails."
2. (0:10) Point at three real cards:
   - Ceremonial Weighing of Handsome Dan. Tue, Nov 17 · 8:30 PM. Beinecke Plaza. The Veritas Search.
   - YASSS Dinner with Dr. Frank van den Bosch. Tue, Nov 17 · 5:15 PM. Pauli Murray Dining Hall.
   - WaMH Talk: Culture, Consent, and Care. Thu, Nov 19 · 4:30 PM. AACC MPR. Free food marker (Hot Murga).
3. (0:20) Click Today. Only Nov 17 events remain (Take it Easy Tuesday, Senior Story, Kitchen Table Talks, Grave of the Fireflies, the Weighing). Click This week again.
4. (0:25) Click Free food. The feed narrows to events whose email mentions food: One Last Sweet Treat Before Thanksgiving Break (Wed, Nov 18, Silliman only), WaMH Talk (Thu, Nov 19) and AACC November Recess Family Dinner (Mon, Nov 23). This week runs today through 7 days out. Say: "Free food is the first filter students asked for."
5. (0:35) Click the WaMH Talk card. The sheet opens: summary, AACC MPR, the catering note, Add to calendar.
6. (0:45) Click Add to calendar. Google Calendar opens with the title, Thu Nov 19 4:30 to 6:00 PM, and AACC MPR. Close the Google tab without saving.
7. (0:55) Press Escape. The sheet closes and focus returns to the card.

If the feed is empty: press 5 on `/demo`, or run `pnpm db:reset`, and reload. If the API is down, set `NEXT_PUBLIC_DATA=fixtures` in .env and restart `pnpm dev`.

---

## CP2: Live intake

Story: a real club email becomes cards in seconds, and so does a flyer. Adds 1:00 to CP1. Inputs: `fixtures/emails/34-yums-weekly-nov-16.json`, `fixtures/flyers/helix-langer-flyer.png`.

1. (0:00) Tab 1, This week. Say: "Here's a YUMS email from Sunday night, written the way club emails are."
2. (0:05) Tab 2, select `34`, press 1. The log row shows the counts, the card titles and per-stage ms (received, extracted, checked, matched, saved).
3. (0:15) Tab 1. Within a few seconds three new cards appear with a highlight, no reload:
   - Pset night. Mon, Nov 16 · 7:00 PM. WLH 011.
   - Putnam problem session. Wed, Nov 18 · 7:00 PM. DL 220.
   - Math Research Panel: Thinking About REUs. Thu, Nov 19 · 4:00 PM. WLH 120.
4. (0:30) Tab 2, select `helix-langer-flyer.png`, press 3. Or show the host path: `/host/upload`, choose the file, watch the processing state.
5. (0:45) Tab 1. New card: Fireside Chat with Robert Langer, Moderna co-founder. Fri, Nov 20 · 1:15 PM. LC 101. Say: "That was a photo of a flyer."
6. (0:55) Open the Langer card, then How this was read. The heading reads "From a flyer", and "FRIDAY, NOV 20", "1:15 PM" and "LC 101" are highlighted. Offline the flyer reads from its saved transcription.

Don't press 2 at CP2: until DEDUP lands at CP3 it creates a second card instead of updating the first.

---

## CP3: Ask and updates

Story: the feed stays correct when plans change, and students can ask in plain words. Adds 1:00 to CP2. Starting state: 34 has been sent. Cold start: select `34`, press 1 first.

What key 4 sends, built at the moment you press it: from Silliman GA, subject "Free pizza in the Buttery right now", body "Free pizza in the Silliman Buttery, Tuesday 11/17, <now> to <now + 45 min>." The card is titled "Free pizza", in the Silliman Buttery.

1. (0:00) Tab 2, press 2. It sends 39, "ROOM CHANGE: Math Research Panel now in LC 102". The log reads `room change: 0 created, 1 updated, 0 in review`.
2. (0:10) Tab 1. The Math Research Panel card reads LC 102 with an Updated badge. Exactly one panel card. Say: "Same event, new room, no duplicate."
3. (0:20) Tab 2, press 4. The log reads `free food now: 1 created`. Tab 1 gets Free pizza with the free food marker.
4. (0:25) Tab 1, Ask box (or `/ask`): "free food tonight", Enter. Free pizza is the only result for tonight. Use the Ask variant from the final script.
5. (0:40) Open the Math Research Panel, then How this was read. The sheet says "Changed: room". The drawer shows the ROOM CHANGE email from YUMS with "Thursday 11/19", "4:00-5:30pm" and "LC 102" highlighted. Use the Source variant from the final script.
6. (0:55) Optional: tab 2, select `40`, press 1. Politics of the Purse (Wed, Nov 18 · 7:00 PM, AACC MPR) shows as Canceled, with no Add to calendar or Save.

Fallbacks:
- "free food tonight" comes back empty (key 4 wasn't pressed): the answer reads "Nothing tonight. These are the next ones." and lists One Last Sweet Treat, WaMH Talk and the AACC November Recess Family Dinner. Keep going.
- Other Ask lines that work offline: "career talk" (Jane Street, Jenna Wiens), "something in JE" answers "Nothing in Jonathan Edwards yet."
- Resending 34 after 39 does not move the panel back: dedup ignores an older email after an update.

Backup beat (not in the 3 minutes): send 21 then 22. Both carry the AASA Night Market, which is seeded, so both come back as same and the feed keeps one card.

---

## CP4: Calendar and alerts

Story: students don't have to come back to the site to stay in the loop. Adds 0:45 to CP3.

1. (0:00) Phone: open the Langer card, tap Add to calendar. Live: it lands in Google Calendar. Sim: `/sim/calendar` shows it on Fri Nov 20 at 1:15 PM.
2. (0:15) Tab 1: the free food alert card, already on (done in setup).
3. (0:20) The press of 4 already sent the alert. Live: show the alert email. Sim: `/sim/outbox` lists the Silliman pizza message.
4. (0:30) Calendar feed subscribe for Free food (`/api/feeds/free-food.ics`).
5. (0:40) The alerts card links to Sunday digest (`/digest`): this week's events in one plain email, in time order.

"Turn off" on the alerts card unsubscribes on the server, so alerts stop going out.

---

## CP5: Hosts and polish

Story: clubs get something back for adding one address. In the final script this is the optional host beat; steps 2 to 4 are extras.

1. `/host`: a club's events with reach totals (views, saves, calendar adds). Totals only, no names.
2. `/sales`: the OCAY gear sale is seeded, so it shows after every reset (crash pads $40, harnesses $15, shoes $10). Don't send 37 live: listings aren't deduped, so it would add a second copy.
3. `/traditions`: The Game (Sat, Nov 21 · 3:30 PM, Fenway Park) and the Weighing of Handsome Dan.
4. Send 36: "Winter break trip meeting" (Thu, Nov 19 · 8:00 PM, WLH 208) shows with a Members only marker.

---

## Recovery

- A card doesn't appear within 10 seconds: reload tab 1 once. If still missing, check the `/demo` log for the failed stage and move on. Don't retry live more than once.
- Claude slow or erroring: set `YAPIZZA_FORCE_SIM=1`, restart `pnpm dev`, continue on replay (Wi-Fi drill below).
- Wrong state after a rehearsal: `/demo` key 5, confirm, reload both tabs.
- Fixtures that make new cards after a reset: 34 (three cards), 31 (the Helix Langer email; matches the flyer if it was already uploaded), 36 (members only). Backup email beat: send 36. 39 after 34 is the room change. 40 cancels Politics of the Purse. Every other fixture matches a seeded card as `same` and adds nothing.
- Calendar insert fails: use the Add to calendar link (no sign-in) or show `/sim/calendar`.
- Anything else: skip to the next beat and say what it does in one sentence. If two beats fail, play the backup recording.

---

## Wi-Fi failure drill (CP4)

Status: not yet rehearsed. Result: ____ Time: ____

Before: the "Demo day: Claude API key" steps are done the same day, so `pnpm grok:record --check` prints 41 of 41.

1. In `.env`, set `YAPIZZA_FORCE_SIM=1`.
2. Stop `pnpm dev` (Ctrl+C) and start it again.
3. `/demo` shows Gmail, calendar, notify and auth as sim and Claude as replay; `/api/integrations/status` shows `forcedSim: true`.
4. Press 5, then run the final script once, start to finish.

What changes on stage, in beat order:
- Club email (34), flyer, room change: replay from `fixtures/grok-replay` if recorded today, so the cards and the room-change match come out as they did live. Without recordings the rules read them at confidence 0.50; the cards still go live when their quotes check out.
- Free food now: its email holds the current time, so it never replays and always runs on the rules. The card still appears.
- Ask: there is no replay for Ask, so it uses keyword search. Use the "Without key" Ask line.
- Source: a recorded room change shows "Read by Claude · confidence 0.9x". A rule-read one shows no Claude line; use the "Without key" Source line.
- Calendar: the Add to calendar link works if the phone has data. Insert lands on `/sim/calendar`, alerts on `/sim/outbox`.

Switch back: set `YAPIZZA_FORCE_SIM=0`, restart `pnpm dev`, confirm `/demo` shows the live services.

---

## Backup recording checklist (CP5)

Record right after the wrap, before anything else changes.

- [ ] Press 5 on `/demo` (Reset demo), confirm, then redo setup (alert opt-in included).
- [ ] Browser zoom 125%. Close other tabs, turn on Do Not Disturb.
- [ ] macOS Cmd+Shift+5, Record Entire Screen, Options: microphone on.
- [ ] Record the final script in order: problem slide, feed and Free food, key 1 (34), key 3 (flyer), key 2 (room change), key 4 (free food now), Ask "free food tonight", How this was read on the Math Research Panel, Add to calendar (show `/sim/calendar` if the phone is not on screen), host page if CP5 landed, close.
- [ ] Save as `yapizza-demo-backup-YYYY-MM-DD.mov`. One copy on the laptop desktop, one on a USB stick or phone.
- [ ] Watch the first 10 seconds back to confirm audio and picture.

Short on time: a 30-second cut. Key 1 (three cards appear), key 2 (Updated badge), the How this was read drawer, then the close line.

---

## Claude replay inputs

`pnpm grok:record` covers 41 inputs: the 40 fixture emails and the flyer. `pnpm grok:record --check` reports how many replay offline today. Record on demo day; replays only work on the day they were recorded. The ones the script uses:

- `34-yums-weekly-nov-16.json` (key 1)
- `fixtures/flyers/helix-langer-flyer.png` (key 3 or `/host/upload`), and `31-helix-langer-flyer.json` (the same flyer by email)
- `39-yums-panel-room-change.json` (key 2). The dedup match against the 34 panel is saved during the live rehearsal, not by `grok:record`.
- `40-aacc-politics-purse-canceled.json` (CP3 optional cancel)
- `21-aasa-night-market-aacc.json`, `22-aasa-night-market-dwight.json` (backup beat)
- `36-ocay-trip-leaders-members-only.json` (CP5)
- Not replayable: key 4's email (holds the current time, runs on the rules offline) and Ask (keyword search offline).

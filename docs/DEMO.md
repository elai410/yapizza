# Yapizza demo script

Owner: qa-demo. One script per checkpoint. Whatever checkpoint we wrap at, run that section. The full story runs 3:00 (CLAUDE.md 14.2). Demo day is Tue, Nov 17, 2026; every event below is real and comes from `fixtures/events.real.md` or `fixtures/emails/`.

## Setup checklist (5 minutes before)

- [ ] `pnpm dev` running on port 3000 in its own terminal. If .env changed since it started, restart it.
- [ ] `pnpm demo:reset` (database back to the seed, sim inbox and outbox cleared). Run it with `pnpm dev` up so the sim reset reaches the app. Run it in a plain terminal, not from a Claude session: Prisma refuses `migrate reset` when Claude Code invokes it.
- [ ] Browser tab 1: `http://localhost:3000/` in a fresh window, so the intro plays once.
- [ ] Browser tab 2: `http://localhost:3000/demo` (CP2 and later). Check the status row: which services are live, which are sim.
- [ ] CP4 and later: phone on the same Wi-Fi, signed in to the demo Google account, Google Calendar app open.
- [ ] Bad Wi-Fi: set `YAPIZZA_FORCE_SIM=1` in .env, restart `pnpm dev`, confirm `/demo` shows every service as sim and Grok as replay.
- [ ] Before the final run: `pnpm grok:record` has been run on every input in "Grok replay inputs" below, so replay mode answers them all.
- [ ] Zoom the browser to 125% for the room.

Seed requirement (integrations, api): `fixtures/events.seed.json` must not already contain the events the demo sends in (the three events in `34-yums-weekly-nov-16.json` and the Helix Langer chat). Otherwise dedup marks them `same` and no card appears. The room change and cancellation targets come from the send step and the seed respectively.

---

## CP0: Foundation (runnable now)

Story: the app boots and the intro sets up the idea. 0:20.

1. Open tab 1 in a fresh window. The intro plays: club email subject lines stream in, collapse into a circle, slice into wedges, and settle as the first row of cards. Under 2.5 seconds.
2. Say: "Every Yale club already sends email. We read it so students don't have to."
3. Reload the tab. The intro does not replay in the same session (sessionStorage `yapizza:intro-seen`).
4. Open a new window, load `/`, press any key during the intro. It skips at once.
5. The shell shows the Yapizza wordmark in the header and an empty or loading feed area. No errors in the page.

Check: with reduced motion on (macOS: Accessibility, Display, Reduce motion), the intro is a short fade.

---

## CP1: Static feed (runnable now)

Story: one calm page for everything happening at Yale this week. 1:00.

Inputs: seeded events only. No sends.

1. (0:00) Tab 1 on `/`, intro skipped or finished. Feed is on This week. Say: "This is everything open to Yale students this week, read from club and office emails."
2. (0:10) Point at three real cards for today and this week:
   - Ceremonial Weighing of Handsome Dan (The Veritas Search). Tue, Nov 17 · 8:30 PM. Beinecke Plaza. YCC.
   - YASSS Dinner with Dr. Frank van den Bosch. Tue, Nov 17 · 5:15 PM. Pauli Murray Dining Hall.
   - WaMH Talk: Culture, Consent, and Care. Thu, Nov 19 · 4:30 PM. AACC MPR. Free food marker (Hot Murga catering).
3. (0:20) Click Today. Only Nov 17 events remain (Take it Easy Tuesday, Senior Story, Kitchen Table Talks, Grave of the Fireflies, the Weighing). Click This week again.
4. (0:25) Click the Free food chip. The feed narrows to events whose email mentions food: One Last Sweet Treat Before Thanksgiving Break (Wed, Nov 18) and WaMH Talk (Thu, Nov 19), plus Applied Math DSAC Bluebooking Session (Mon, Nov 16) if the week view includes past days. Say: "Free food is the first filter students asked for."
5. (0:35) Click the WaMH Talk card. The detail sheet opens: summary, AACC MPR, the catering note, Add to calendar.
6. (0:45) Click Add to calendar. A new tab opens Google Calendar with the title, Thu Nov 19 4:30 to 6:00 PM, and AACC MPR filled in. Say: "One tap, and it's in the calendar Yale students already use." Close the Google tab without saving.
7. (0:55) Press Escape. The sheet closes and focus returns to the card.

If the feed is empty: the seed has not loaded. Run `pnpm db:reset` and reload. If the API is down, `NEXT_PUBLIC_DATA=fixtures` in .env and restart `pnpm dev`.

---

## CP2: Live intake (runnable; the flyer beat needs Grok live or a recorded replay)

Story: a real club email becomes cards in seconds, and so does a flyer. Adds 1:00 to CP1.

Inputs: `fixtures/emails/34-yums-weekly-nov-16.json`, `fixtures/flyers/helix-langer-flyer.png`.

1. (0:00) Start on tab 1, This week. Say: "Here's a YUMS email from Sunday night, written the way club emails are."
2. (0:05) Tab 2, `/demo`. Press 1 (Send club email), the fixture select defaults to `34`. The log row shows server ms, counts (new, updated, review) and the card titles.
3. (0:15) Back to tab 1. Within a few seconds three new cards appear with a highlight, no reload:
   - Pset night. Mon, Nov 16 · 7:00 PM. WLH 011.
   - Putnam problem session. Wed, Nov 18 · 7:00 PM. DL 220.
   - Math Research Panel with Prof. Ian Adelstein. Thu, Nov 19 · 4:00 PM. WLH 120.
   Say: "One messy email, three events, tagged academic."
4. (0:30) Tab 2, press 3 (Upload flyer), pick `helix-langer-flyer.png`. Or show the host path: `/host/upload`, choose the file, watch the processing state.
5. (0:45) Tab 1. New card: Fireside Chat with Robert Langer. Fri, Nov 20 · 1:15 PM. LC 101. Yale Helix. Say: "That was a photo of a flyer. Grok read it."
6. (0:55) Open the Langer card and show the summary matches the flyer.

Known at CP2: in replay mode with no recording, the flyer returns no events (logged for pipeline). If it hasn't been fixed, skip beats 4 to 6. Don't press 2 (room change) at CP2: until DEDUP lands at CP3 it creates a second card instead of updating the first.

---

## CP3: Ask and updates (draft until CP3 passes)

Story: the feed stays correct when plans change, and students can ask in plain words. Adds 1:00 to CP2.

Starting state: CP2 just ran, so 34 has been sent and the three YUMS cards are on the feed, including Math Research Panel, Thu, Nov 19 · 4:00 PM, WLH 120. If you start at CP3 cold, press 1 with `34` selected first.

Inputs: `fixtures/emails/39-yums-panel-room-change.json` (key 2), the free food now email (key 4), Ask query "free food tonight". Optional: `40-aacc-politics-purse-canceled.json` (key 1 with `40` selected).

What key 4 sends (built at the moment you press it, from `src/app/api/demo/[action]/route.ts`): from `Silliman GA <silliman-ga@lists.yale.test>`, subject "Free pizza in the Buttery right now", body "Free pizza in the Silliman Buttery, Tuesday 11/17, <now> to <now + 45 min>. Open to all Yalies, first come first served." Pressing 4 again the same day updates that card instead of adding one.

1. (0:00) Tab 2, `/demo`, press 2 (Send room change). It sends 39, subject "ROOM CHANGE: Math Research Panel now in LC 102": "the Math Research Panel on Thursday 11/19 (4:00-5:30pm) has moved from WLH 120 to LC 102." The log row reads `room change: 0 created, 1 updated, 0 in review`.
2. (0:10) Tab 1, This week. Within 3 seconds the Math Research Panel card reads Thu, Nov 19 · 4:00 PM, LC 102, with an Updated badge. There is still exactly one Math Research Panel card. Say: "Same event, new room, no duplicate."
3. (0:20) Tab 2, press 4 (Free food now). The log row reads `free food now: 1 created`. Tab 1 gets "Free pizza in the Silliman Buttery" at the current time, with the free food marker.
4. (0:25) Tab 1, go to `/ask` (or use the Ask box on the feed). Type "free food tonight" and press Enter. Expect a short answer and the Silliman Buttery pizza card with a one-line why. No seeded event on Nov 17 has free food, so this card is the only expected result. Say: "Plain words in, events out, each one from a real email."
5. (0:40) Open the Silliman Buttery pizza card, then click "How this was read". The drawer shows the subject, the sender (Silliman GA), and the email text, with Grok's evidence quotes highlighted (the day and time, "Tuesday 11/17, ..."; the place, "Silliman Buttery"). Below it, one line: "Read by Grok · confidence 0.xx". Say: "Every card keeps its source. The highlighted quotes are what Grok used, and code checks they are really in the email."
6. (0:55) Optional: `/demo`, select `40` in the fixture list, press 1. Politics of the Purse (Wed, Nov 18 · 7:00 PM, AACC MPR) shows as canceled.

Fallbacks:
- Ask returns nothing for "free food tonight" (the clock or the parser read "tonight" narrowly): ask "free food this week". Expect the Silliman pizza plus seeded free food: One Last Sweet Treat Before Thanksgiving Break (Wed, Nov 18 · 2:00 PM) and WaMH Talk: Culture, Consent, and Care (Thu, Nov 19 · 4:30 PM, AACC MPR, Hot Murga).
- Ask shows no "Read by Grok" line: it answered in keyword fallback (`mode: 'fallback'`). The cards are still right; keep going.
- Grok in replay (no key, or `YAPIZZA_FORCE_SIM=1`): the free food now email can never hit a recording, because its text carries the current time. It runs through the rule-based extractor, gets confidence 0.50, and the drawer shows a Review badge. For beat 5, open Putnam problem session (Wed, Nov 18 · 7:00 PM, DL 220) from the feed instead; it comes from the recorded 34. Avoid the Math Research Panel drawer: it shows the original email 34 with WLH 120 highlighted, since the update keeps the first source.
- Replay with no recording of 34: the rule-based extractor titles the panel "MATH RESEARCH PANEL: thinking about REUs". The room change still matches it (same host, same day). Record 34 before the final run so the title reads Math Research Panel.

Checks before calling CP3 passed (qa-demo):
- Free food now comes from Silliman GA, which has nothing seeded on Nov 17, so it always makes a new card (integrations verified 17:30).
- If CP4 is in the run, opt the demo student in to free food alerts before beat 3, so one press of 4 also shows the alert.

Backup beat (not in the 3 minutes): send 21 then 22. Both carry the AASA Night Market; the feed shows one card. It is also in the seed, so both sends should come back as same.

---

## CP4: Calendar and alerts (draft until CP4 passes)

Story: students don't have to come back to the site to stay in the loop. Adds 0:45 to CP3.

Inputs: free food alert opt-in for a demo student, `/demo` key 4 (Free food now), one event to add (Fireside Chat with Robert Langer).

1. (0:00) On the phone, open the Langer card, tap Add to calendar. Live: it lands in Google Calendar on the phone. Sim: open `/sim/calendar`, the event sits on Fri Nov 20 at 1:15 PM.
2. (0:15) On tab 1, opt in to free food alerts as the demo student.
3. (0:20) Tab 2, press 4 (Free food now). A toast appears on tab 1. Live: the alert email arrives. Sim: `/sim/outbox` lists the message.
4. (0:30) Show the calendar feed subscribe option for Free food (`/api/feeds/free-food.ics`).
5. (0:40) Show the Sunday digest preview: this week's events in one plain email.

---

## CP5: Hosts and polish (draft until CP5 passes)

Story: clubs get something back for adding one address. Adds 0:30, only if time allows; otherwise cut to the close.

Inputs: `fixtures/emails/37-ocay-gear-sale.json`, `fixtures/emails/36-ocay-trip-leaders-members-only.json`.

1. `/host`: Yale Helix's events with reach totals (views, saves, calendar adds). Totals only, no names.
2. `/sales`: send 37 first; the OCAY gear sale shows as a listing (crash pads $40, harnesses $15, shoes $10), not an event.
3. `/traditions`: The Game (Sat, Nov 21 · 3:30 PM, Fenway Park) and the Weighing of Handsome Dan as recurring Yale events.
4. Check, not a beat: after sending 36, the OCAY winter break trip meeting is members only and does not appear in the open feed.

---

## Close (all checkpoints)

"One address per club. Students never join another list." 0:10.

---

## Recovery

- A card doesn't appear within 10 seconds: reload tab 1 once. If still missing, check the `/demo` log for the failed stage and move to the next beat. Don't retry live more than once.
- Grok is slow or erroring: set `YAPIZZA_FORCE_SIM=1`, restart `pnpm dev`, and continue in replay. Every input below has a recording.
- Wrong state after a rehearsal (duplicate cards, panel already moved): `pnpm demo:reset`, reload both tabs.
- Only these fixtures make new cards against the seed (pipeline, 17:30): 34 (three YUMS cards), 31 (Helix Langer flyer email), 09 (AGPC Kickoff), 36 (members-only planning meeting). Backup email beat: send 09. Every other fixture matches a seeded card as `same` and adds nothing. 39 needs 34 sent first; 40 cancels the seeded Politics of the Purse.
- Feed empty: `pnpm db:reset`, reload. Last resort: `NEXT_PUBLIC_DATA=fixtures`, restart `pnpm dev`.
- Calendar insert fails: use the Add to calendar link (always works, no sign-in) or show `/sim/calendar`.
- Anything else: skip to the next beat and say what it does in one sentence. If two beats fail, play the backup recording.

---

## Grok replay inputs

Run `pnpm grok:record` on every one of these before the final run. Each one is a Grok call in CP2 or CP3.

- `fixtures/emails/34-yums-weekly-nov-16.json` (key 1, CP2; also the CP3 starting state)
- `fixtures/flyers/helix-langer-flyer.png` (key 3 or `/host/upload`, CP2; same flyer as `31-helix-langer-flyer.json`)
- `fixtures/emails/31-helix-langer-flyer.json` (email with the flyer attached)
- `fixtures/emails/39-yums-panel-room-change.json` (key 2, CP3: extraction and the dedup match against the 34 panel)
- `fixtures/emails/40-aacc-politics-purse-canceled.json` (key 1 with `40`, CP3: extraction and the cancel match)
- Free food now email (key 4, CP3 and CP4). It cannot be replayed: its text holds the current time, so the replay key changes on every press. Offline it always uses the rule-based extractor.
- Ask queries: "free food tonight", "free food this week" (CP3). Answers depend on the database, so a recording only helps if the state matches the run.
- `fixtures/emails/21-aasa-night-market-aacc.json`, `22-aasa-night-market-dwight.json` (same event, two lists, CP3 backup beat)
- `fixtures/emails/37-ocay-gear-sale.json` (listing, CP5)
- `fixtures/emails/36-ocay-trip-leaders-members-only.json` (members only, CP5)

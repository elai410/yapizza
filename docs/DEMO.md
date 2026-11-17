# Yapizza demo script

Owner: qa-demo. One script per checkpoint. Whatever checkpoint we wrap at, run that section. The full story runs 3:00 (CLAUDE.md 14.2). Demo day is Tue, Nov 17, 2026; every event below is real and comes from `fixtures/events.real.md` or `fixtures/emails/`.

## Setup checklist (5 minutes before)

- [ ] `pnpm dev` running on port 3000 in its own terminal. If .env changed since it started, restart it.
- [ ] `pnpm demo:reset` (database back to the seed, sim inbox and outbox cleared). Run it with `pnpm dev` up so the sim reset reaches the app.
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
   - YASSS Dinner with Dr. Frank van den Bosch. Tue, Nov 17 · 5:15 PM. Pauli Murray Dining Hall. Free food marker.
   - WaMH Talk: Culture, Consent, and Care. Thu, Nov 19 · 4:30 PM. AACC MPR. Free food marker (Hot Murga catering).
3. (0:20) Click Today. Only Nov 17 events remain (Take it Easy Tuesday, Senior Story, Kitchen Table Talks, Grave of the Fireflies, the Weighing). Click This week again.
4. (0:25) Click the Free food chip. The feed narrows to events whose email mentions food: YASSS Dinner, WaMH Talk, the Putnam problem session (Wed, Nov 18 · 7:00 PM, DL 220, pizza). Say: "Free food is the first filter students asked for."
5. (0:35) Click the WaMH Talk card. The detail sheet opens: summary, AACC MPR, the catering note, Add to calendar.
6. (0:45) Click Add to calendar. A new tab opens Google Calendar with the title, Thu Nov 19 4:30 to 6:00 PM, and AACC MPR filled in. Say: "One tap, and it's in the calendar Yale students already use." Close the Google tab without saving.
7. (0:55) Press Escape. The sheet closes and focus returns to the card.

If the feed is empty: the seed has not loaded. Run `pnpm db:reset` and reload. If the API is down, `NEXT_PUBLIC_DATA=fixtures` in .env and restart `pnpm dev`.

---

## CP2: Live intake (draft until CP2 passes)

Story: a real club email becomes cards in seconds, and so does a flyer. Adds 1:00 to CP1.

Inputs: `fixtures/emails/34-yums-weekly-nov-16.json`, `fixtures/flyers/helix-langer-flyer.png`.

1. (0:00) Start on tab 1, This week. Say: "Here's a YUMS email from Sunday night, written the way club emails are."
2. (0:05) Tab 2, `/demo`. Press 1 (Send club email), pick `34-yums-weekly-nov-16`. The live log shows received, extracted, checked, matched, saved, with timings.
3. (0:15) Back to tab 1. Within a few seconds three new cards appear with a highlight, no reload:
   - Pset night. Mon, Nov 16 · 7:00 PM. WLH 011.
   - Putnam problem session. Wed, Nov 18 · 7:00 PM. DL 220.
   - Math Research Panel with Prof. Ian Adelstein. Thu, Nov 19 · 4:00 PM. WLH 120.
   Say: "One messy email, three events, tagged academic."
4. (0:30) Tab 2, press 3 (Upload flyer), pick `helix-langer-flyer.png`. Or show the host path: `/host/upload`, choose the file, watch the processing state.
5. (0:45) Tab 1. New card: Fireside Chat with Robert Langer. Fri, Nov 20 · 1:15 PM. LC 101. Yale Helix. Say: "That was a photo of a flyer. Grok read it."
6. (0:55) Open the Langer card and show the summary matches the flyer.

---

## CP3: Ask and updates (draft until CP3 passes)

Story: the feed stays correct when plans change, and students can ask in plain words. Adds 1:00 to CP2.

Inputs: `fixtures/emails/39-yums-panel-room-change.json`, Ask query "free food tonight". Optional: `40-aacc-politics-purse-canceled.json`, `21-aasa-night-market-aacc.json` then `22-aasa-night-market-dwight.json`.

1. (0:00) Tab 2, press 2 (Send room change). This sends 39: "the Math Research Panel on Thursday 11/19 (4:00-5:30pm) has moved from WLH 120 to LC 102."
2. (0:10) Tab 1. The same Math Research Panel card now reads LC 102 with an Updated badge. No second card. Say: "Same event, new room, no duplicate."
3. (0:20) Type "free food tonight" in the Ask box (or go to `/ask`). The answer is two sentences or fewer and cards come back with a short why. Before 6 PM expect the YASSS Dinner; later in the evening, press 4 (Free food now) on `/demo` first so tonight has a result. If the demo is on another day, ask "free food this week".
4. (0:40) Open a result, then open "How this was read". The source email shows with Grok's evidence quotes highlighted for time and place, and one small "Read by Grok" line.
5. (0:50) Optional: send 40 from `/demo`. Politics of the Purse (Wed, Nov 18 · 7:00 PM, AACC MPR) shows as canceled.

Backup beat (not in the 3 minutes): send 21 then 22. Both carry the AASA Night Market; the feed shows one card.

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
- Feed empty: `pnpm db:reset`, reload. Last resort: `NEXT_PUBLIC_DATA=fixtures`, restart `pnpm dev`.
- Calendar insert fails: use the Add to calendar link (always works, no sign-in) or show `/sim/calendar`.
- Anything else: skip to the next beat and say what it does in one sentence. If two beats fail, play the backup recording.

---

## Grok replay inputs

Run `pnpm grok:record` on every one of these before the final run.

- `fixtures/emails/34-yums-weekly-nov-16.json` (send, CP2)
- `fixtures/flyers/helix-langer-flyer.png` (upload, CP2; same flyer as `31-helix-langer-flyer.json`)
- `fixtures/emails/31-helix-langer-flyer.json` (email with the flyer attached)
- `fixtures/emails/39-yums-panel-room-change.json` (room change and dedup, CP3)
- `fixtures/emails/40-aacc-politics-purse-canceled.json` (cancellation, CP3)
- `fixtures/emails/21-aasa-night-market-aacc.json`, `22-aasa-night-market-dwight.json` (same event, two lists, CP3)
- Ask queries: "free food tonight", "free food this week" (CP3)
- Free food now demo action payload (CP3, CP4)
- `fixtures/emails/37-ocay-gear-sale.json` (listing, CP5)
- `fixtures/emails/36-ocay-trip-leaders-members-only.json` (members only, CP5)

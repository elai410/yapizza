# Yapizza demo video (1:00)

Status: plan only. Record after the design pass is final (see "Lock before recording").

**The prompt:** if you could build the perfect app for Yale students that doesn't exist yet, what would it be?

**The answer in one line:** Yale has friction on both sides. Students can't find events or fit them into their week. Clubs can't recruit or fill the room. Yapizza removes the work for both, because Claude does the reading, the matching and the searching. Win-win.

**Last frame of the video:** "The perfect app for Yale students."

Format: 16:9, 1920x1080, browser zoom 125%. Voiceover plus burned-in captions (judges often watch muted). Quiet music bed. Every screen is the real app with the Claude key live. No mockups.

Voiceover: about 105 words, a calm pace for 60 seconds.

## Structure

| Act | Time | Point |
|---|---|---|
| Problem | 0:00 to 0:10 | Friction on both sides |
| Clubs: zero work | 0:10 to 0:33 | Clubs change nothing; Claude turns the emails and flyers they already make into events |
| Students: zero friction | 0:33 to 0:52 | Find it, ask for it, trust it, get it on the calendar |
| Win-win | 0:52 to 1:00 | Clubs get turnout, students get their week; the answer to the prompt |

## Scenes

| # | Time | Len | On screen | Voiceover |
|---|---|---|---|---|
| 1 | 0:00 | 7s | Split screen. Left: a student's inbox, unread club emails piling up next to a full Google Calendar week. Right: a club's sent folder, the same weekly email going out again. Blur every person's name and address. | "Students can't find events, or fit them in. Clubs can't fill the room. Friction on both sides." |
| 2 | 0:07 | 3s | Fresh window on `/`. The intro plays in full: subject lines stream, collapse into a circle, slice into wedges, land as the first row of cards. | (none, let it land) |
| 3 | 0:10 | 8s | **Clubs.** Caption: "One address on the club's list." The YUMS email (`34`) on the left, the feed on the right. Send it. Pset night, Putnam problem session and Math Research Panel appear with the highlight. **Uncut**, so "in seconds" is visibly true. | "For clubs, nothing changes. Keep sending your email. Claude reads it into events in seconds." |
| 4 | 0:18 | 10s | **The flyer drop.** The club's Instagram flyers pop onto screen as a grid (edit overlay, about 1s). Cut to a real Finder window: select all, drag them in one motion onto the drop zone on `/host/upload` (For clubs). Every flyer starts reading at once; each row turns from "Reading the flyer · 3s" into its event card next to the flyer thumbnail. **Uncut**: the slowest flyer took 7.8s in testing. | "Already made a flyer? Drop them all in. Claude reads every one." |
| 5 | 0:28 | 5s | Room change email (key 2): the Math Research Panel card goes from WLH 120 to LC 102 with the Updated badge, still one card. Quick cut: the cancel email (`40`) and Politics of the Purse shows Canceled. | "Room change, same card. Canceled, it says so. Nobody types a thing." |
| 6 | 0:33 | 4s | **Students.** Feed, This week. Click Free food, then a college. The list narrows. | "For students, every open event at Yale, in one place." |
| 7 | 0:37 | 6s | Ask box: type "free food tonight", Enter. Free pizza (Silliman Buttery) comes first with its reason; "Read by Claude" under the answer. | "Ask in plain words. Claude finds it." |
| 8 | 0:43 | 4s | Open Math Research Panel, then How this was read. The room-change email with "LC 102" and the time highlighted. Push in on the highlights. | "Every card shows the words it came from." |
| 9 | 0:47 | 5s | Phone, close up. Tap Add to calendar on the Langer card; it lands in Google Calendar next to the student's classes. Cut: the free food alert email arrives. Cut: Subscribe on the Free food calendar feed. | "One tap fits it into your week. Free food finds you." |
| 10 | 0:52 | 4s | **Win-win.** `/host`: the club's events with reach totals (views, saves, calendar adds). Then three quick flashes, under a second each: Sunday digest, Traditions (The Game), Sales board. | "Clubs see their turnout grow. Totals, never names." |
| 11 | 0:56 | 4s | Split screen returns from scene 1, now resolved: the host page on the right, the student's calendar with the events in it on the left. Fade to white. Final text, alone on screen: "The perfect app for Yale students." | "Zero work for clubs. Zero friction for students. The perfect app for Yale students." |

## The flyer drop (scene 4)

Flyers, cropped from the clubs' Instagram posts (no Instagram UI, no commenter handles), in `fixtures/flyers/`:

| File | Club | Flyer says | Read in testing (Nov 17, Claude Haiku, live) |
|---|---|---|---|
| `ycc-bulldog-block-party.png` | YCC | Sun, Oct 18 · 4 to 7 PM, Old Campus, free food | Matched the seeded card, so "No new events". Correct dedup, but reads as a miss on camera |
| `ycc-coffee-shop-buyout.png` | YCC | Wed, Apr 29 · 12:30 to 4 PM, drink tickets on Cross Campus | Cross Campus, free coffee. **Wrong year: Thu, Apr 29, 2027.** Review |
| `la-casa-super-bowl-lx.png` | La Casa, Despierta Boricua, LUL | YSB Marsh · Feb 8 · 6 PM, food and drinks | **"Vsb Marsh"**, **Mon, Feb 8, 2027.** Review |
| `tas-tastes-of-taiwan.png` | TAS, YTSA, AACC | Sun 11/16 · 12:30 to 2:30, AACC | AACC, host YTSA. **Mon, Nov 16, 2026** (the flyer is from 2025). Review |
| `bakers-dozen-family-weekend.png` | Baker's Dozen | Sat 10/10 · 5:30 PM, 230 Temple St. | Correct, Sat, Oct 10, 2026. Review |
| `whiffenpoofs-jam-2026.png` | Whiffenpoofs | Fri, Feb 6 · 7:30 PM, Sudler Hall | Correct, Fri, Feb 6, 2026. Shown as "Sudler Hall 100". Review |

**Decision (human, Nov 17):** keep these six, past dates and all. Scene 4 shows that Claude reads any flyer; the students' scenes use the email events and Helix, which are current.

What this means on camera:
- The upload cards show a time, not a date, so the past and wrong years don't show in scene 4.
- Five rows say "1 needs review" next to the timing, because Claude rated the past, yearless dates 0.5 to 0.6. That's the guardrail working; no voiceover needed.
- The Bulldog Block Party row says "No new events in this file." because it matched the card already in the feed. Leave it in: it shows dedup.
- These cards stay off the student feed, so no later scene should rely on them.
- If `pipeline` fixes the year rule before capture (requested on the board), the rows may come back live instead. Either way, never edit a flyer's date in the image or the edit.

Before shooting: Reset demo (key 5), drop the six once off camera to confirm they read the same, then reset again and shoot.

## Feature coverage

Everything a student or host touches is on screen at least once.

| Feature | Scene |
|---|---|
| Intro animation | 2 |
| Email intake (one address, or forward) | 3 |
| One email, several events | 3 |
| Live updates and new-card highlight | 3 |
| Flyer upload, many at once, read by Claude vision | 4 |
| Duplicate matching (a flyer for an event already listed adds nothing) | 4 |
| Update matching (no duplicates) | 5 |
| Cancellations | 5 |
| Feed, Today and This week, filters (free food, college) | 6 |
| Ask Yapizza | 7 |
| How this was read (evidence quotes) | 8 |
| Add to Google Calendar | 9 |
| Free food alerts | 9 |
| Calendar feeds | 9 |
| Host page with reach totals | 10 |
| Sunday digest, Traditions, Sales board | 10 |

Left out on purpose: the members-only marker, Save, and `/demo` and `/sim/*` (demo tools, not product).

## Capture order (not the edit order)

1. `/demo` key 5 (Reset), confirm. Opt the demo student in to free food alerts. Phone signed in to the demo Google account.
2. Scene 2 first, in a new window, so the intro plays once. Grab two takes.
3. Scene 6 (feed and filters) while the feed is clean.
4. Scene 3: key 1 on `34`. Record the email and the feed side by side in one take.
5. Scene 4: Finder window with the six Instagram flyers, dragged onto `/host/upload`. One take; if any row errors, reset and retake. Then, off camera, `/demo` key 3 with `helix-langer-flyer.png` so the Langer card exists for scene 9.
6. Scene 5: key 2, then select `40` and press key 1.
7. Key 4 (makes Free pizza and sends the alert). Film the alert email arriving on the phone for scene 9.
8. Scene 7 (Ask), then scene 8 (drawer).
9. Scene 9: Add to calendar on the phone, then Subscribe on the free food feed.
10. Scene 10: `/host` after the calendar add, so the reach totals aren't zero. Then the digest, `/traditions` and `/sales`.
11. Scenes 1 and 11 last; they don't depend on app state.

## Lock before recording

Every scene shows design and frontend work that is still moving. Recheck these on capture day and shoot only once they are final:

- Intro timing and the wordmark handoff (2)
- New-card highlight motion (3)
- Upload page rows: flyer thumbnail, reading timer, card (4). Cards there show a time but no date, and a duplicate flyer says "No new events in this file." (both requested on the board)
- Updated and Canceled badges (5)
- Ask result layout and the "Read by Claude" line (7)
- Source drawer highlight style (8)
- Mobile detail sheet, Add to calendar, feed subscribe UI (9)
- Host page reach totals layout (10)

## If it runs long

Cut in this order: the three flashes in 10, then the cancel half of 5, then trim the grid overlay in 4. Never cut 1, 3, 4, 5's room change, 9 or 11. Those carry the two-sided story.

## Rules

- `docs/COPY.md` rules apply to captions and title cards: no exclamation marks, no em dashes, no "AI-powered". "Seamless" is a banned word there, so the voiceover says "zero work" and "zero friction" instead.
- Speed ramps and trims are fine on waits, except scenes 3 and 4. Don't fake a result the app didn't produce.
- The voiceover credits Claude with reading, matching and searching. It doesn't call it a reasoning model: the app runs Claude Haiku with thinking off.

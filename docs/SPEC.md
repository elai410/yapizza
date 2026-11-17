# Yapizza: Project Spec

Nov 17, 2026 · @Edward Lai

## Overview

Yapizza is one place to see everything happening at Yale, built from the emails and flyers clubs already make. Clubs add one address to their mailing list or upload a file. Grok turns each message into a clean event, and students browse, search, and add events to Google Calendar in one tap.

It solves three problems:

- **Students don't read club emails**, so they miss what's happening. Even when they do, nobody copies events into Google Calendar by hand.
- **There are too many mailing lists.** Nobody wants to join them all and flood their inbox.
- **Hosts can't reach people easily.** They want every event in front of as many students as possible, but promoting it across lists, posters, and Instagram is tedious.

The name: "yap" is all the email chatter, and "apizza" is New Haven's pizza. MIT's DormSoup, which turns dorm mailing-list emails into an events website, is a reference point only. Yapizza is its own product: it adds file uploads, Grok search, calendar import, alerts, and Yale-specific knowledge.

## Problem

Information about campus life is everywhere and nowhere. It lives in hundreds of separate club and college mailing lists, posters, Instagram posts, and group chats.

**For students**

- Inboxes fill with club emails that get skimmed or archived unread. The free food, the talk, the cultural night: all missed.
- Even a student who wants to go has to copy the title, time, and room into Google Calendar by hand. Most don't.
- Finding something specific ("free food tonight," "a community for X") means searching an inbox you never subscribed to in the first place.
- Every club and residential college has its own list with its own signup. Joining all of them means drowning; joining few means missing out.

**For hosts**

- Promoting one event means emailing several lists, making a flyer, posting on Instagram, and sending reminders.
- There's no single place where every student will see it, so reach depends on who already joined your list.
- Room changes and cancellations go out as more emails that people also don't read.

**For Yale as a whole**

- Traditions and recurring events are poorly documented. Each year's organizers and first-years rediscover them from scratch.
- YaleClubs already offers a club and event directory, but clubs have to post there separately. Yapizza works from what they already send.

## Users and goals

Students are the main users; hosts supply the content. Both have to win for Yapizza to work.

| User | What they want | What Yapizza gives them |
| --- | --- | --- |
| Students | Know what's happening without reading email or joining lists | One feed, filters, Grok search, one-tap calendar import, alerts |
| First-years | Find their people and learn Yale traditions | Community search, a Traditions page, "new this week" picks |
| Club and org hosts | Reach the most students with the least effort | One address to add, file upload, automatic calendar-ready events, reach stats |
| Residential colleges and offices | Get college events, teas, and announcements seen | Same intake as clubs, plus a residential college filter |
| Food-motivated students (everyone) | Free food, fast | Free food tag and instant alerts |

## How it works

Every way in feeds one Grok pipeline, and every way out reads from one events database.

&#91;embedded content: Yapizza pipeline · 3 ways in, 3 Grok steps, 4 ways out\]

Grok uses the Yale context list to read places and slang. Anything that fails a check waits for a host instead of reaching the feed.

## Student features

The student side has one job: get the right events in front of a student, and onto their calendar, with zero effort.

1. **Campus feed.** Today, tomorrow, and this week, as event cards. Each card shows title, time, place, host, tags, and a link to the original email or flyer.
2. **Tags and filters.** Free food, Cultural, Professional, Academic, Social, Arts and performances, Athletics, Traditions. An event can carry several tags (a cultural night with free food gets both). Extra filters: date, residential college, and "open to all" versus members only.
3. **Ask Yapizza.** A Grok-powered search box. Students type "free food tonight" or "I'm looking for a community for Taiwanese students" and get real events and clubs back, each linked to its source.
4. **One-tap add to Google Calendar.** Every card has an Add to Calendar button that fills in title, time, room, and description.
   - MVP: a Google Calendar link that opens a prefilled event. No login needed.
   - V1: Google sign-in with the Calendar API, so Yapizza can update the event if the room or time changes.
5. **Calendar feeds.** Subscribe once to a filter ("Free food," "Cultural," or a club you follow) as a calendar feed. New matching events show up in Google Calendar automatically, with no clicking per event. This is the fix for students who won't add things one at a time.
6. **Follow clubs and tags.** Follow without joining a mailing list. Followed items shape the feed, the digest, and alerts.
7. **Free food alerts.** Opt-in push, text, or email when a free food event starts soon or a host posts leftovers. Free food is gone in 20 minutes, so speed matters more here than anywhere else.
8. **Sunday digest.** One weekly email with the week's best events, personalized to what you follow. One email replaces dozens.
9. **Traditions.** A page of recurring Yale events, with when they happened last year and what to expect.
10. **Sales and free stuff.** A separate board for listings (furniture, tickets, giveaways) so they don't clutter the event feed.
11. **Live updates.** If a host sends a room change or cancellation, the card updates, calendar feeds update, and students who saved it get a heads-up.

## Host features

Hosts should never have to do more than they do today. Every way in takes what they already have.

1. **The Yapizza address.** A club adds one email address to its Google Group or mailing list. Every email they send from then on is read and turned into events automatically.
2. **Forward to add.** Anyone (host or student) forwards an event email to the Yapizza address. This fills the site before clubs sign up.
3. **File upload.** Hosts drop in whatever they have:
   - Flyers and posters (PNG, JPG, a photo of a bulletin board)
   - Instagram post screenshots
   - PDFs and slide decks
   - A spreadsheet or CSV of a whole semester's events
   - Calendar files (.ics)
4. **Paste and post.** A quick form: paste a blurb, Grok fills in the title, time, place, and tags, and the host checks it before posting.
5. **Host dashboard.** A club officer signs in with their NetID and claims their club. They see every event Yapizza pulled from their emails and files, can fix mistakes, and can mark events as members only.
6. **Edits that spread.** A host's edit or cancellation updates the card, calendar feeds, and anyone who saved the event.
7. **Recurring events.** Weekly meetings and office hours are entered once and repeat.
8. **Reach stats.** Totals only: views, saves, and calendar adds per event. Hosts never see who saved what.

## How we use Grok

Grok does seven jobs inside Yapizza, and the database and code around it do the rest. Grok turns messy input into clean data and turns student questions into searches. It never invents events, and it never takes actions on its own.

**Model.** We use `grok-4.7`, which xAI lists as its flagship text model, with a 500k-token context window, priced at $2.00 per 1M input tokens and $6.00 per 1M output tokens ([xAI models page](https://docs.x.ai/docs/models)). Its reasoning is set per request with `reasoning_effort`. We run bulk jobs at low effort and save higher effort for duplicate matching. Recheck the models page at build time, since lineups change.

### The seven Grok jobs

| Job | Input | Output | Grok feature | Effort |
| --- | --- | --- | --- | --- |
| 1. Extract events | Email subject, body, sender, list name, sent date | JSON list of events (can be empty) | Structured outputs | Low |
| 2. Read files and flyers | Flyer or screenshot image, PDF text, CSV rows | Same event JSON | Image input + structured outputs | Low |
| 3. Tag and classify | One extracted event | Tags, free food flag, audience, event or listing | Structured outputs with fixed tag list | Low |
| 4. Match duplicates and updates | New event + the 5 closest existing events | New, same, update, or cancel, with the matching event id | Structured outputs | Medium |
| 5. Ask Yapizza search | A student's question | Calls to our search tools, then a short answer that cites event ids | Function calling | Low |
| 6. Write the Sunday digest | A student's top events for the week | A short, friendly email | Plain text | Low |
| 7. Spot traditions | Past events grouped by title and host across years | Recurring series with typical timing | Structured outputs, run weekly | Medium |

### 1 to 3: Turning emails and files into events

Every email or upload goes through one extraction call that returns events in a fixed schema. xAI's structured outputs return JSON that matches the schema we supply, with types, enums, and date-time formats enforced ([structured outputs guide](https://docs.x.ai/docs/guides/structured-outputs)).

```json
{
  "events": [{
    "title": "Taiwanese Night Market",
    "start": "2026-12-04T18:00:00-05:00",
    "end": "2026-12-04T20:00:00-05:00",
    "location_raw": "Silliman courtyard",
    "location_id": "silliman-courtyard",
    "host": "Taiwanese American Society",
    "summary": "Street food, games, and boba.",
    "tags": ["cultural", "free_food", "social"],
    "food": "bubble tea and snacks",
    "audience": "open_to_all",
    "rsvp_url": null,
    "kind": "event",
    "evidence": ["Friday 12/4, 6-8pm", "Silliman courtyard"],
    "confidence": 0.93
  }]
}
```

- **Context in every call:** today's date in New York time (so "this Friday" resolves correctly), the email's sent date, and a Yale glossary of places, college names, and abbreviations (WLH, LC, Sudler, Commons, JE, TD, Dport, butteries). Grok maps a raw place to a `location_id` from that list.
- **Flyers and screenshots:** xAI accepts JPEG and PNG images up to 20 MiB each, as a URL or base64 ([image understanding guide](https://docs.x.ai/docs/guides/image-understanding)). The same docs advise turning off stored request history when sending images, so we set that off for these calls.
- **PDFs and CSVs:** our code pulls the text or rows out first, then sends them through the same extraction call.
- **Not every email is an event.** A newsletter with no events returns an empty list. A sale or giveaway is marked `kind: listing` and goes to the Sales board.
- **Tags come from a fixed enum:** free\_food, cultural, professional, academic, social, arts, athletics, traditions. Free food is also its own true or false field so alerts can trigger on it.

### 4: Duplicates and updates

The same event arrives on five lists, then as a reminder, then as a "room change!" email. Before saving, our code finds the 5 closest existing events (same host or similar title, within a few days). Grok decides whether the new one is new, the same, an update, or a cancellation, and lists which fields changed. Updates edit the existing event and trigger the live-update flow.

### 5: Ask Yapizza

Grok gets three tools, and our code runs them against the database:

- `search_events(keywords, tags, date_from, date_to, college, free_food)`
- `search_clubs(keywords)`
- `get_event(id)`

Grok turns "free food tonight near Silliman" into a `search_events` call with the free food tag, tonight's date range, and a nearby-location hint. It then picks the best results and writes one line on why each fits. **The event cards are drawn from the database, not from Grok's text,** so a card can't show a made-up time or place.

### Guardrails

- **No invented events.** Each extracted event includes short quotes from the source for its time and place. Our code checks those quotes actually appear in the email. If a check fails or confidence is below 0.7, the event goes to a review queue instead of the feed.
- **Emails are data, not instructions.** The extraction call has no tools, so an email that says "ignore your rules" can't make Grok do anything. The worst case is a bad event, which the schema and checks catch.
- **Validate anyway.** xAI recommends validating output when strict conformance matters, so every response is checked against the schema in code before saving.
- **Search can only cite real results.** Ask Yapizza may only reference event ids returned by its tools. Any other id is dropped.

### Quality and cost

- **Test set:** hand-label about 50 real club emails from the team's inboxes. Track how often Grok gets the title, start time, and place right, and how often duplicate matching is correct. Rerun the test after any prompt change.
- **Skip repeat work:** the same email sent to several lists has the same Message-ID, so we process it once.
- **Rough cost:** an email of about 1,500 tokens in and 300 out costs about $0.005 at listed prices. Even 1,000 emails a week comes to about $5. Reasoning tokens add some output cost, which is why bulk jobs run at low effort.

## Yale-specific design

Yapizza should know Yale the way an upperclassman does: its places, colleges, slang, calendar, and traditions. That is what a generic events app can't copy.

- **NetID login.** Students and hosts sign in with their Yale NetID through Yale's central login. The full feed is Yale-only, and hosts claim clubs under their NetID.
- **Google Calendar is already there.** Yale College accounts come through EliApps, Yale's Google setup, which includes Gmail and Google Calendar ([Yale Student Technology](https://studenttechnology.yale.edu/new-students/set-your-yale-email)). One-tap add lands in the calendar students already use.
- **Residential colleges.** A filter for each of the 14 colleges, college-only events shown to that college's students, and college emails (teas, study breaks, formals) handled like club emails. A student's college can come from the Yalies directory, which has a public API ([Yale Computer Society](https://yalecomputersociety.org/)), with the student's OK.
- **A Yale places list.** Grok maps raw locations to known places with map pins, using the names students actually say ([Yale Lingo](https://yalecollege.yale.edu/get-know-yale-college/yale-lingo)):
  - Buildings: WLH, LC, AKW, KT, CEID, TEAL, Sudler, PWG, Science Hill
  - Dining and hangouts: Commons (Schwarzman Center), the 14 butteries, Slifka
  - Cultural centers: AACC, Af-Am House, La Casa, NACC
- **Yale words in search.** Ask Yapizza understands "teas," "rush," "The Game," "pset," "FroCo," "Dport," and "JE," so students can ask the way they talk.
- **The academic calendar.** Yapizza knows about Camp Yale, recesses, Reading Period, and finals. During Reading Period, the digest leads with study breaks and free food.
- **Traditions.** A seeded list of recurring Yale events (Camp Yale, The Game, a cappella rush, Spring Fling, college teas), grown each year by the traditions job in the Grok section.
- **Works with what exists.** Each host links to its YaleClubs page when there is one. Yapizza doesn't replace the directory; it fills it with events clubs never posted there.

## Data model

Ten tables cover everything. Every event points back to the source it came from, so any card can show the original email or flyer.

| Table | Key fields | Notes |
| --- | --- | --- |
| sources | id, type (email, forward, upload, form), message\_id, sender, list\_name, received\_at, raw\_text, file\_url, status | One row per email or file; message\_id stops double processing |
| events | id, source\_id, host\_id, title, start, end, all\_day, place\_id, location\_raw, summary, tags\[\], free\_food, food, audience, college, rsvp\_url, kind, confidence, status (live, review, canceled), series\_id | The core table; status review keeps low-confidence events off the feed |
| event\_versions | event\_id, changed\_fields, from\_source\_id, changed\_at | History of room changes and edits, used for update alerts |
| hosts | id, name, type (club, college, office), yaleclubs\_url, verified, officer\_netids\[\] | Verified hosts auto-publish |
| places | id, name, aliases\[\], building\_code, lat, lng | The Yale places list Grok maps to |
| series | id, title, host\_id, typical\_month, years\_seen\[\], is\_tradition | Recurring events and traditions |
| listings | id, source\_id, title, price, details, expires\_at | Sales and free stuff, kept off the event feed |
| users | id, netid, college, alert\_channels, digest\_on, gcal\_connected | Created at first login |
| follows | user\_id, host\_id or tag | Shapes feed, digest, alerts, calendar feeds |
| saves | user\_id, event\_id, added\_to\_gcal, gcal\_event\_id | Who to notify on updates; hosts only see totals |

## Architecture and tech stack

One web app, one database, one background worker, and the Grok API. Pick tools the team already knows; the choices below are defaults, not requirements. The flow diagram in How it works shows how the pieces connect.

| Component | What it does | Hackathon choice | Later |
| --- | --- | --- | --- |
| Intake inbox | Receives list emails and forwards | A new Google account read through the Gmail API, checked every minute | Gmail push notifications instead of polling |
| Upload service | Takes flyers, PDFs, CSVs, .ics files | Upload form to file storage (Supabase Storage or S3) | Drag-and-drop on the host dashboard |
| Worker | Runs the pipeline: extract, tag, dedup, save, notify | One script on a timer | A proper job queue with retries |
| Grok client | Calls the xAI API | OpenAI-compatible SDK pointed at `https://api.x.ai/v1` | Same, plus batching for backfills |
| Database | Stores everything in Data model | Postgres (Supabase or Neon) with full-text search | Add a places map and analytics tables |
| Web app and API | Feed, filters, Ask Yapizza, host pages | Next.js | Same |
| Calendar | Add to Google Calendar, calendar feeds | Prefilled Google Calendar links; one .ics feed per filter | Google sign-in and the Calendar API for live updates |
| Notifications | Free food alerts, digest, update alerts | Email only | Web push and text messages |
| Login | NetID for students and hosts | Google sign-in limited to yale.edu accounts | Yale's central NetID login |

## Privacy, safety, and moderation

Yapizza only reads what someone chose to send it. It never touches a student's personal inbox.

**What we read**

- Emails sent to the Yapizza address: list emails from clubs that added it, and emails someone forwarded on purpose.
- Files hosts upload.
- Nothing else. No student connects their own inbox.

**What we keep**

- The event fields, plus the source text so each card can link to its original.
- For forwarded emails, we drop the forwarder's own name, signature, and any text above the forwarded message.
- Raw source text is deleted after the event ends plus 30 days; event fields stay for the traditions archive.
- Email and file content is sent to xAI for processing. We check xAI's data retention terms and tell clubs this plainly before they add the address.

**Who sees what**

- The whole site sits behind Yale login.
- Hosts can mark events members only or college only. If Grok can't tell, the event is held for review rather than shown to everyone.
- Hosts see totals (views, saves, calendar adds), never names.

**Who can post, and how bad content is stopped**

- Verified hosts (a club officer who claimed the club with their NetID) publish automatically.
- Events from unverified senders or forwards are labeled unverified, or go to review if confidence is low.
- Every card has a report button. Reported events are hidden until reviewed.
- The extraction call also flags content that looks like harassment or spam, which sends it to review.

**Calendar access**

- The MVP needs no calendar permissions at all: the button opens a prefilled Google Calendar event.
- When we add live updates, we ask for the narrowest Calendar permission that lets us create and edit only the events Yapizza added.

## Hackathon MVP and demo

The MVP proves one loop end to end: a club email or flyer goes in, a correct event comes out, and a student finds it and adds it to Google Calendar. This plan assumes a short build window of about four hours; add the nice-to-haves if there's more time.

**Must have**

- [ ] Intake inbox read through the Gmail API, seeded with 30 to 50 real club emails forwarded from the team's inboxes
- [ ] Flyer image upload
- [ ] Grok extraction, tagging, and simple duplicate matching
- [ ] Feed with tag filters (free food, cultural, professional, academic)
- [ ] Ask Yapizza search with tool calling
- [ ] Add to Google Calendar button

**Nice to have**

- [ ] Free food email alert
- [ ] Calendar feed for one filter (.ics)
- [ ] Sunday digest preview

**Not in the MVP:** host dashboard, NetID login, traditions detection, text and push alerts.

**Team split (four people)**

| Role | Owns |
| --- | --- |
| Pipeline | Gmail intake, upload, worker, database |
| Grok | Extraction, tagging, dedup prompts and schemas, the 50-email test set |
| Frontend | Feed, filters, event cards, Add to Calendar, Ask Yapizza box |
| Demo and data | Seed emails, real flyers, the demo script, slides, backup recording |

**Demo script (about 3 minutes)**

1. Show a real Yale inbox full of unread club emails. This is how students find out what's happening today.
2. Forward a fresh club email to the Yapizza address live. Seconds later it appears in the feed, tagged.
3. Upload a photo of a real flyer from a campus bulletin board. It becomes an event too.
4. Send a "room change" email for the same event. The existing card updates instead of a duplicate appearing.
5. Type "free food tonight" into Ask Yapizza. Real events come back with sources.
6. Tap Add to Calendar on a phone. The event appears in Google Calendar.
7. Close on the ask: one email address per club, and nobody has to join another list.

## Success metrics

Yapizza works if events are correct, hosts plug in, and students come back every week. The targets below are proposals for the team to adjust.

| Metric | Proposed target | When |
| --- | --- | --- |
| Start time correct on the 50-email test set | 95% or better | Hackathon |
| Place correct on the test set | 90% or better | Hackathon |
| Duplicates showing in the feed | Under 2% of events | Hackathon |
| Clubs and colleges with the address added | 50 | First month after launch |
| Students active weekly | 25% of undergrads | End of first semester |
| Calendar adds per week | Growing every week | Ongoing |
| Free food alert sign-ups | 1,000 students | End of first semester |
| Host corrections per 100 events | Under 5 | Ongoing |

## Risks and open questions

The biggest risk is getting clubs to plug in; the second is students forgetting the site exists. Both have a plan below.

| Risk | Why it matters | Plan |
| --- | --- | --- |
| Clubs don't add the address | An empty feed means nobody comes back | Forward to add fills the feed first; pitch to YCC and college councils; show hosts their reach |
| Wrong times or places | One wrong free food time and students stop trusting it | Source quotes checked in code, review queue, host edits, link to the original on every card |
| Students forget the website | Event apps tend to lose to a plain weekly email | Sunday digest, free food alerts, calendar feeds that work without opening the site |
| Members-only info shown to everyone | Breaks trust with hosts | Audience field, hold for review when unsure, hosts control visibility |
| Spam, fake events, harassment | Damages the campus feed | Yale login, unverified labels, report button, Grok flags for review |
| Overlap with YaleClubs | Looks like a copy | Link to YaleClubs pages; consider partnering with Yale Computer Society |
| Yale policy concerns | A takedown request ends the project | Talk to Yale ITS and the Yale College Dean's Office early |

**Open questions**

- [ ] Should the intake address be a Gmail account or a yale.edu address?
- [ ] Do club Google Groups allow outside addresses to subscribe, or only yale.edu ones?
- [ ] Partner with Yale Computer Society on YaleClubs, or stay separate?
- [ ] What do Yale's IT and data policies say about reading list emails?
- [ ] How long should raw emails be kept?
- [ ] How long is the build window, and how many people are on the team?

## Roadmap

Ship the MVP at the Grokathon, prove it with a small pilot, then open it to every club in the spring.

&#91;embedded content: Roadmap · 4 phases, 3 gates\]

Each diamond is a gate: the next phase starts only once its number is met. The gate numbers match Success metrics.

## Sources

- [xAI models page](https://docs.x.ai/docs/models)
- [xAI structured outputs guide](https://docs.x.ai/docs/guides/structured-outputs)
- [xAI image understanding guide](https://docs.x.ai/docs/guides/image-understanding)
- [Yale Student Technology: Set up your Yale email](https://studenttechnology.yale.edu/new-students/set-your-yale-email)
- [Yale Computer Society products](https://yalecomputersociety.org/)
- [Yale College: Yale Lingo](https://yalecollege.yale.edu/get-know-yale-college/yale-lingo)
- [DormSoup on GitHub](https://github.com/DormSoup) (reference only)

# Yapizza pitch

Owner: qa-demo. Five slides, then the live demo carries the rest. Plain words, no superlatives.

## Slide 1: Problem

- Yale runs on email: clubs, colleges, cultural centers, and offices each send their own weekly list.
- A student on ten lists gets dozens of these a week and reads few. The free dinner, the room change, the college tea all get buried.
- The events are already written down. They just aren't in one place. Image: a real Yale inbox full of unread club emails.

## Slide 2: Demo

- A club adds one address to its list, forwards an email, or uploads a flyer. Grok turns each one into an event card in seconds.
- Students filter by free food or college, ask in plain words, and add an event to Google Calendar in one tap.
- Live: YUMS email to three cards, Helix flyer to a card, room change updates the same card, "free food tonight".

## Slide 3: How Grok reads Yale

- **Context, not guessing.** Every extraction call carries today's date in New York, the email's sent date, a Yale glossary (WLH, LC, DL, Commons, Dport, JE, teas), and the Yale places list with aliases (WLH, LC, AKW, Sudler, Commons, each college dining hall and buttery). "Thursday 11/19, 4:00-5:30pm, WLH 120" resolves to a real time and a known room.
- **Structured output, checked twice.** Grok answers in strict JSON schema mode. The schema is written once in zod, sent to xAI with `z.toJSONSchema`, and every reply is parsed with the same zod schema before we use it.
- **Evidence, checked in code.** Each event carries short verbatim quotes for its time and place. Code confirms every quote is in the source text, ignoring case and whitespace. A failed check, a missing date, or confidence under 0.7 sends the event to review, not the feed. The "How this was read" drawer shows the email with those quotes highlighted.
- **Email is data.** The extraction call has no tools, and the prompt says to ignore instructions in the message. The worst a hostile email can do is produce a wrong card that fails its checks.
- **Updates, not duplicates.** Each new event is compared with up to 5 existing events within 3 days that share a host, a similar title, or the same start and place. Grok returns a MatchDecision (new, same, update, cancel) with the changed fields, and only a candidate's real id is accepted. An update writes a version row and the card shows Updated.
- **Works offline.** Record mode saves every Grok reply under a hash of model, prompt version, and input; replay mode answers from those files with no network. Prompts carry a version line, so changing a prompt invalidates its recordings. If Grok is unreachable or a recording is missing, a rule-based extractor and matcher take over, and their events go through the same evidence check.

## Slide 4: Why only at Yale

- It speaks Yale: WLH, Dport, JE, teas, The Game, pset nights, and all 14 residential colleges as places and filters.
- Built from lists Yale already has (YCC, AACC, YUMS, Good Life Center, college GAs), not a new place clubs must post.
- Google Calendar is every student's calendar through EliApps, so one tap lands where they already look.

## Slide 5: What's next

- Pilot with YCC and two residential college councils adding the address.
- Yale login, host claims by NetID, and a review queue for unverified senders.
- Free food alerts, calendar feeds, and a Sunday digest, so students don't have to open the site.

---

## Judge Q&A

**How accurate is it?**
We measure it with `pnpm eval`, which runs extraction on 12 hand-labeled fixture emails (built from real Yale club and office emails) and reports per-field accuracy for title, start, place, free food, audience, and event versus listing. Current numbers: title TBD, start TBD, place TBD, free food TBD. On top of that, every event cites quotes from its source for time and place, code checks them before the event goes live, and anything that fails or that Grok is unsure of waits in review. Every card links to the original email so a student can check.

**What about privacy?**
We store what was sent to Yapizza: the source email's text, subject, list name, and sender address (a list or office address), plus the events read from it. We never connect to a student's inbox; the intake is a club-facing address that clubs add to their own list, plus forwards and uploads people choose to send. Students' own email is never read. Hosts see totals, never names. Email text is sent to xAI to be read, and clubs are told that before they add the address.

**Why would clubs adopt it?**
It costs them one subscriber address and nothing else; they keep sending what they already send. Until they add it, any student can forward an email to fill the feed. Hosts get reach totals they don't have today. First pitch is to YCC and college councils.

**Isn't this YaleClubs?**
YaleClubs is a directory clubs have to post to separately. Yapizza works from email they already send, and links each host to its YaleClubs page. It fills the directory with events that were never posted there. We'd like to work with the Yale Computer Society on it.

**What does each email cost?**
About 1,500 tokens in and 300 out, roughly $0.005 per email at listed prices, so 1,000 emails a week is about $5. Measured cost from our runs: TBD. The same email sent to several lists shares a Message-ID and is processed once.

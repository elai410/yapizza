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

## Judge Q&A (CP5 prep)

Each answer is two or three sentences. Numbers marked TBD have not been measured yet; say so if asked.

**How accurate is it?**
Every event carries short quotes for its time and place, and code checks each quote is really in the source text before the event goes live. A failed check, a missing date, or confidence under 0.7 puts the event in review instead of the feed. `pnpm eval` reports field accuracy on 12 hand-labeled fixture emails: Grok TBD; the rule-based fallback alone scored about 90% in pipeline's last run.

**What about privacy?**
We store only what is sent to Yapizza: the email text, subject, list name, sender address (a list or office address), and the events read from it. We never read a student's inbox; intake is one club-facing address, plus forwards and uploads people choose to send. Email text goes to xAI to be read, and hosts see reach totals, never names.

**Why would clubs adopt it?**
A club adds one address to its mailing list and keeps sending what it already sends. There is no new form, account, or posting step. Until a club adds the address, any member can forward its email, and hosts get reach totals they don't have today.

**Isn't this YaleClubs?**
It complements YaleClubs. YaleClubs lists the clubs; Yapizza reads what they send and turns it into events with times and rooms. Each host can link to its YaleClubs page.

**What does each email cost?**
One extraction call per email at low reasoning effort, plus a match call at medium effort only when a similar event already exists nearby. A repeat of the same Message-ID skips Grok entirely. Cost per email: TBD, measured once we run with a key.

**Can an email hijack Grok?**
The extraction call has no tools, so an instruction inside an email has nothing to act on. The prompt treats the message as data, the reply must match a strict JSON schema, and the evidence check still applies. The worst case is a wrong card that fails its checks and waits in review.

**What happens when Grok is wrong?**
Low confidence or a failed evidence check sends the event to review, and the drawer shows a Review badge. A follow-up email (a room change or a cancellation) updates the same card instead of adding a new one. At CP5, a host who claims the club can edit or cancel its events.

**Why Grok?**
Vision reads flyer photos directly. Structured outputs give us strict JSON we validate with the same zod schema. Tool calling lets Ask search the database in up to 3 rounds, and the UI shows only events whose ids exist.

**Does it work beyond Yale?**
Not as is. It is built on Yale places, Yale lingo, and the 14 residential colleges, which is why it reads "WLH 120" or "JE buttery" correctly. Another school would need its own glossary and places list; the pipeline itself would carry over.

# Yapizza pitch

Owner: qa-demo. Five slides, then the live demo carries the rest. Plain words, no superlatives.

## Slide 1: Problem

- Yale runs on email: clubs, colleges, cultural centers, and offices each send their own weekly list.
- A student on ten lists gets dozens of these a week and reads few. The free dinner, the room change, the college tea all get buried.
- The events are already written down. They just aren't in one place. Image: a real Yale inbox full of unread club emails.

## Slide 2: Demo

- A club adds one address to its list, forwards an email, or uploads a flyer. Claude turns each one into an event card in seconds.
- Students filter by free food or college, ask in plain words, and add an event to Google Calendar in one tap.
- Live: YUMS email to three cards, Helix flyer to a card, room change updates the same card, "free food tonight".

## Slide 3: How Claude reads Yale

- **Context, not guessing.** Every extraction call carries today's date in New York, the email's sent date, a Yale glossary (WLH, LC, DL, Commons, Dport, JE, teas), and the Yale places list with aliases (WLH, LC, AKW, Sudler, Commons, each college dining hall and buttery). "Thursday 11/19, 4:00-5:30pm, WLH 120" resolves to a real time and a known room.
- **Structured output, checked twice.** Claude answers through structured outputs: a JSON schema written once in zod and sent with the request via `z.toJSONSchema`, and every reply is parsed with the same zod schema before we use it.
- **Evidence, checked in code.** Each event carries short verbatim quotes for its time and place. Code confirms every quote is in the source text, ignoring case and whitespace. A failed check, a missing date, or Claude confidence under 0.7 sends the event to review, not the feed. The "How this was read" drawer shows the source with those quotes highlighted, and says "Read by Claude" only when Claude read it.
- **Email is data.** The extraction call has no tools, and the prompt says to ignore instructions in the message. The worst a hostile email can do is produce a wrong card that fails its checks.
- **Updates, not duplicates.** Each new event is compared with up to 5 existing events within 3 days that share a host, a similar title, or the same start and place. Claude returns a MatchDecision (new, same, update, cancel) with the changed fields, and only a candidate's real id is accepted. An update writes a version row, the card shows Updated, and an older email arriving later never undoes it.
- **Works offline.** Record mode saves every Claude reply under a hash of model, prompt version, and input; replay mode answers from those files with no network. Prompts carry a version line, so changing a prompt invalidates its recordings. If Claude is unreachable or a recording is missing, a rule-based extractor and matcher take over, and their events go through the same evidence check.

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
Every event carries short quotes for its time and place, and code checks each quote is really in the source text before the event goes live. A failed check, a missing date, or Claude confidence under 0.7 puts the event in review instead of the feed. `pnpm eval` reports field accuracy on 12 hand-labeled fixture emails (Claude: TBD). `pnpm eval --heldout` scores the rule-based fallback alone on 211 held-out seed labels: 91%. Claude should beat that; we will say the Claude number only once we have measured it.

**How do I know Claude read a card?**
Each event stores who read it: Claude or the rule-based fallback. The "How this was read" drawer says "Read by Claude" with its confidence only when Claude did; a card read by the rules shows no Claude line. We would rather under-claim than show a Claude label on a card Claude never saw.

**What about privacy?**
We store only what is sent to Yapizza: the email text, subject, list name, sender address (a list or office address), and the events read from it. We never read a student's inbox; intake is one club-facing address, plus forwards and uploads people choose to send. Email text goes to Anthropic to be read, hosts see reach totals, never names, and a student who turns off free food alerts is unsubscribed on the server.

**Why would clubs adopt it?**
A club adds one address to its mailing list and keeps sending what it already sends. There is no new form, account, or posting step. Until a club adds the address, any member can forward its email, and hosts get reach totals they don't have today.

**Isn't this YaleClubs?**
It complements YaleClubs. YaleClubs lists the clubs; Yapizza reads what they send and turns it into events with times and rooms. Each host can link to its YaleClubs page.

**What does each email cost?**
One Claude extraction call per email at low effort, plus a match call at medium effort only when a similar event already exists nearby. A repeat of the same Message-ID skips Claude entirely. Cost per email: TBD, measured once we run with a key.

**Can an email hijack Claude?**
The extraction call has no tools, so an instruction inside an email has nothing to act on. The prompt treats the message as data, the reply must match a strict JSON schema, and the evidence check still applies. The worst case is a wrong card that fails its checks and waits in review.

**What happens when plans change?**
A room change or a cancellation updates the same card instead of adding a new one: the card shows Updated or Canceled, and the drawer shows the newest source, so the room-change email is what you see with the new room highlighted. If an older email about the same event arrives after the update, dedup ignores it, so the room never flips back. At CP5, a host who claims the club can edit or cancel its events.

**What happens when Claude is wrong?**
Low confidence or a failed evidence check sends the event to review instead of the feed, and the drawer marks it Needs review. The source email is one click away on every card, so a student can check it themselves.

**Why Claude?**
Claude reads flyer photos directly as images. Structured outputs give us JSON that matches our schema, which we still validate with zod. Tool use lets Ask search the database in up to 3 rounds, and the UI shows only events whose ids exist.

**Does it work beyond Yale?**
Not as is. It is built on Yale places, Yale lingo, and the 14 residential colleges, which is why it reads "WLH 120" or "JE buttery" correctly. Another school would need its own glossary and places list; the pipeline itself would carry over.

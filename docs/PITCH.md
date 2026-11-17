# Yapizza pitch

Owner: qa-demo. Five slides, then the live demo carries the rest. Plain words, no superlatives.

## Slide 1: Problem

- Yale runs on email. Clubs, colleges, cultural centers, and offices each send their own weekly list.
- A student on ten lists gets dozens of messages a week, most unread. The free dinner, the room change, the tea with a speaker: all buried.
- The events are already written down. Nobody has to post anything new; the information just isn't in one place.
- Image: a real Yale inbox full of unread club emails.

## Slide 2: Demo

- A club adds one address to its mailing list, forwards an email, or uploads a flyer.
- Grok turns each message into a clean event card in seconds.
- Students browse, filter by free food or college, ask in plain words, and add an event to Google Calendar in one tap.
- Live: YUMS email to three cards, Helix flyer to a card, room change updates the same card, "free food tonight".

## Slide 3: How Grok reads Yale

- Every extraction gets the current New York time, the email's sent date, a Yale glossary, and a places list (WLH, LC, AKW, Sudler, Commons, the 14 colleges and their butteries).
- Grok returns structured JSON checked against a schema in code. Each event carries short quotes from the source for its time and place; code confirms those quotes are really in the email.
- A failed quote check or confidence under 0.7 sends the event to review instead of the feed.
- Updates and duplicates: new events are matched against nearby ones from the same host, so a room change edits the card and a cancellation marks it canceled.
- Email is data, not instructions: the extraction call has no tools, so a hostile email can't make it act.

## Slide 4: Why only at Yale

- It speaks Yale: WLH, Dport, JE, teas, The Game, pset nights.
- Residential colleges are first class: a filter for each of the 14, college-only events stay with that college.
- Built from the emails Yale clubs already send, from real Yale lists (YCC, AACC, YUMS, Good Life Center, college GAs).
- Google Calendar is already every student's calendar through EliApps, so one tap lands where they look.

## Slide 5: What's next

- Pilot with YCC and two residential college councils adding the address.
- Yale login, host claims by NetID, and the review queue for unverified senders.
- Free food alerts, calendar feeds, and a Sunday digest so students don't have to open the site.
- Talk to Yale ITS and the Yale College Dean's Office early about reading list email.

---

## Judge Q&A

**How accurate is it?**
Every event cites quotes from its source for time and place, and code checks them before the event goes live. Anything that fails, or that Grok is unsure of, waits in review. On our labeled test set: title TBD, start time TBD, place TBD (from `pnpm eval`). Every card links to the original email so a student can check.

**What about privacy?**
Yapizza only reads what someone chose to send it: list emails to its address, forwards, and uploads. It never connects to a student's inbox. Forwards have the forwarder's name and signature stripped. Raw text is deleted 30 days after the event ends. Hosts see totals, never names. Content is sent to xAI for processing, and clubs are told that before they add the address.

**Why would clubs adopt it?**
It costs them one subscriber address and nothing else; they keep sending what they already send. Until they add it, any student can forward an email to fill the feed. Hosts get reach totals they don't have today. First pitch is to YCC and college councils.

**Isn't this YaleClubs?**
YaleClubs is a directory clubs have to post to separately. Yapizza works from email they already send, and links each host to its YaleClubs page. It fills the directory with events that were never posted there. We'd like to work with the Yale Computer Society on it.

**What does each email cost?**
About 1,500 tokens in and 300 out, roughly $0.005 per email at listed prices, so 1,000 emails a week is about $5. Measured cost from our runs: TBD. The same email sent to several lists shares a Message-ID and is processed once.

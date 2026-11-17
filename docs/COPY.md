# Yapizza: visual direction and copy

Owner: `design`. Every user-facing string lives here or follows these rules. `frontend` asks before inventing a new label.

## Direction

A calm list of what is happening at Yale this week. It reads like CourseTable or Yalies: content first, dense enough to scan, no decoration. The feed is the product; chrome stays out of its way.

- **Ground:** warm off-white page (`bg`), white cards (`surface`), hairline borders (`line`). No gradients, glass, glow, blur, or shadows beyond a 1px lift.
- **Accent:** Yale Blue `#00356B` (`accent`) for the one primary action on a screen, selected filters, links, and focus rings. Nothing else is blue.
- **Meaning colors, only when they mean it:** green `food` for free food, red `cancel` for canceled, amber `update` for a changed room or time. Tags are otherwise neutral grey.
- **Type:** Geist, one family. Times use `.tnum` (tabular numerals). Sizes: 13 (meta), 15 (body), 17 (card title), 24 (page title). Weights 400, 500, 600 only.
- **Wordmark:** "Yapizza" set in Geist 600 with tight tracking. The one place for personality is the intro, where the inbox becomes the pizza.
- **Motion:** short and functional. Cards enter with a 6px rise and fade (180 ms). A new card from live intake gets a brief accent-soft wash that fades over 1.5 s. Filters crossfade the list. Everything respects reduced motion.
- **Grok shows only where it does the work:** one small "Read by Grok" line in the Ask box and in the "How this was read" drawer. Nowhere else.

## Rules

- Labels are 3 words or fewer. Buttons are verbs.
- Empty states are one plain sentence.
- Times: `Thu, Dec 4 · 6:00 PM`. Ranges: `6:00 to 7:30 PM`.
- No exclamation marks, no em dashes, no emoji.
- Banned: discover, explore, unlock, seamless, vibrant, curated, elevate, magic, effortless, journey, AI-powered.
- Yale words as students say them: WLH, LC, Commons, Sudler, Dport, JE, TD.
- The student UI never says "simulated". Only `/sim/*` and `/demo` do.

## Strings

| Where | String |
|---|---|
| Page title | Yapizza |
| Meta description | Every Yale event from the emails and flyers clubs already send. |
| Nav | Events · Ask · Traditions · Sales · Hosts |
| Range tabs | Today · This week |
| Filter chips | Free food · Cultural · Career · Academic · Social · Arts · Athletics · Traditions |
| College filter | All colleges |
| Card marker | Free food (with the food, e.g. "Free food · Pizza") |
| Badges | Updated · Canceled · Needs review |
| Detail actions | Add to calendar · Save · Saved · RSVP |
| Source drawer | How this was read · Read by Grok (only when readBy is grok; fallback events show no line, their Needs review badge says enough) |
| Evidence label | From the email |
| Ask placeholder | Free food tonight, career talks this week |
| Ask button | Ask |
| Ask fallback note | Showing keyword matches. |
| Upload page title | Upload a flyer |
| Upload button | Upload flyer |
| Upload processing | Reading the flyer |
| Upload done | Added to Yapizza. |
| Live toast | New event: {title} |
| Update toast | Updated: {title} |
| Empty feed | Nothing on the calendar today. · Nothing on the calendar this week. |
| Empty feed (filters) | No events match these filters. |
| Empty Ask | No events match that. |
| Error | Couldn't load events. · Couldn't load this event. |
| Retry button | Try again |
| Calendar feeds | Subscribe · Copy link |
| Alerts | Free food alerts · Turn on · Turn off |
| Digest | Sunday digest |
| Hosts | Claim club · Your events · Edit · Cancel event |
| Sales | Sales board |
| Skip link | Skip to content |

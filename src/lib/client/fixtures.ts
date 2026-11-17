import type { EventDetail, Tag, Audience } from '@/lib/contracts';

// Fallback data for NEXT_PUBLIC_DATA=fixtures. Real events from fixtures/events.real.md, week of Nov 16, 2026.
// shortcut: hand-written subset, swap for fixtures/events.seed.json once integrations ships it.

type Row = {
  id: string; title: string; start: string; end?: string; place?: string; host?: string;
  tags: Tag[]; food?: string; college?: string; audience?: Audience; summary: string; rsvp?: string;
};

const ROWS: Row[] = [
  { id: 'fx-craft-collages', title: 'Craft et Veritas: Collages', start: '2026-11-16T15:00', end: '2026-11-16T16:00', place: 'YSC Offline Oasis', host: 'Good Life Center', tags: ['arts', 'social'], summary: 'Weekly craft drop-in. This week: collages.' },
  { id: 'fx-matsci-ross', title: 'Materials Science Seminar: Frances Ross', start: '2026-11-16T14:30', end: '2026-11-16T15:30', place: 'Rosenfeld Hall 101', host: 'Materials Science', tags: ['academic'], summary: 'Seminar by Frances Ross of MIT.' },
  { id: 'fx-bluebook', title: 'Applied Math Bluebooking Session', start: '2026-11-16T17:00', end: '2026-11-16T18:00', place: 'HQ 132', host: 'Applied Math DSAC', tags: ['academic', 'free_food'], food: 'Nice Day Chinese', summary: 'Plan spring courses with Applied Math DSAC. Nice Day Chinese catering.' },
  { id: 'fx-take-it-easy', title: 'Take it Easy Tuesday', start: '2026-11-17T14:00', end: '2026-11-17T16:00', place: 'GLC Lounge', host: 'YC3', tags: ['social'], summary: 'Drop-in break at the Good Life Center lounge.' },
  { id: 'fx-senior-story', title: 'Senior Story: Kelly Dai and Jen Chen', start: '2026-11-17T17:00', end: '2026-11-17T18:00', place: 'AACC MPR', host: 'AACC', tags: ['cultural'], summary: 'Two seniors share their Yale stories.' },
  { id: 'fx-yasss-dinner', title: 'YASSS Dinner with Dr. Frank van den Bosch', start: '2026-11-17T17:15', place: 'Pauli Murray Dining Hall', host: 'YASSS', tags: ['academic', 'free_food'], food: 'Dinner', college: 'Pauli Murray', summary: 'Dinner and conversation with astronomer Frank van den Bosch.' },
  { id: 'fx-kitchen-table', title: 'Kitchen Table Talks', start: '2026-11-17T18:00', end: '2026-11-17T19:00', place: 'MENACC, 305 Crown St', host: 'YC3', tags: ['social', 'cultural'], summary: 'First session of a new YC3 conversation series.' },
  { id: 'fx-fireflies', title: 'Grave of the Fireflies Screening', start: '2026-11-17T19:30', end: '2026-11-17T21:30', place: 'Davenport Auditorium', host: 'AACC', tags: ['arts', 'cultural'], college: 'Davenport', summary: 'Screening and discussion.' },
  { id: 'fx-weighing-dan', title: 'Ceremonial Weighing of Handsome Dan', start: '2026-11-17T20:30', place: 'Beinecke Plaza', host: 'The Veritas Search', tags: ['traditions'], summary: 'Guess his weight. Closest guess wins a capsule. Entry form closes 8:10 PM, must be present.' },
  { id: 'fx-sweet-treat', title: 'One Last Sweet Treat Before Break', start: '2026-11-18T14:00', place: 'College St Gate', host: 'Silliman GA', tags: ['social', 'free_food'], food: 'Sweets', college: 'Silliman', summary: 'Meet at the College St gate for a treat before Thanksgiving break.' },
  { id: 'fx-putnam', title: 'YUMS Putnam Problem Session', start: '2026-11-18T19:00', end: '2026-11-18T21:00', place: 'DL 220', host: 'YUMS', tags: ['academic', 'free_food'], food: 'Pizza and snacks', summary: 'Weekly Putnam practice. Exam is Sat, Dec 5.' },
  { id: 'fx-purse', title: 'Politics of the Purse', start: '2026-11-18T19:00', end: '2026-11-18T20:00', place: 'AACC MPR', host: 'AACC', tags: ['academic'], summary: 'Fiscal policy simulation.' },
  { id: 'fx-ymun-china', title: 'YMUN China Secretariat Info Session', start: '2026-11-18T20:30', end: '2026-11-18T21:30', place: 'WTS A51', host: 'YMUN China', tags: ['professional'], summary: 'Info session for the 2027 Secretariat. Applications due Nov 29.' },
  { id: 'fx-poetry', title: 'Grammars of Possibility: Poetry Workshop', start: '2026-11-19T12:00', end: '2026-11-19T13:30', place: 'AACC MPR', host: 'AACC', tags: ['arts'], summary: 'Poetry workshop with Michelle Phuong Ho.' },
  { id: 'fx-yums-panel', title: 'YUMS Math Research Panel', start: '2026-11-19T16:00', end: '2026-11-19T17:30', place: 'WLH 120', host: 'YUMS', tags: ['academic', 'professional'], summary: 'REU panel with Prof. Ian Adelstein.' },
  { id: 'fx-wamh', title: 'WaMH Talk: Culture, Consent, and Care', start: '2026-11-19T16:30', end: '2026-11-19T18:00', place: 'AACC MPR', host: 'YC3', tags: ['cultural', 'free_food'], food: 'Hot Murga', summary: 'Student-led affinity space. Hot Murga catering.' },
  { id: 'fx-fellowships', title: 'Imagining Your Summer', start: '2026-11-19T16:00', end: '2026-11-19T17:00', place: 'Poorvu 120A', host: 'Office of Fellowships', tags: ['professional'], summary: 'Summer funding and fellowship options.' },
  { id: 'fx-langer', title: 'Fireside Chat with Robert Langer', start: '2026-11-20T13:15', place: 'LC 101', host: 'Yale Helix', tags: ['academic', 'professional'], summary: 'Fireside chat with the Moderna co-founder.' },
  { id: 'fx-the-game', title: 'Yale vs. Harvard: The Game', start: '2026-11-21T15:30', place: 'Fenway Park, Boston', host: 'Yale Athletics', tags: ['athletics', 'traditions'], summary: 'Yale College buses to Boston. Return bus 8:30 PM.' },
  { id: 'fx-aacc-family', title: 'AACC November Recess Family Dinner', start: '2026-11-23T16:00', end: '2026-11-23T18:00', place: 'AACC', host: 'AACC', tags: ['cultural', 'free_food'], food: 'Dinner', summary: 'Annual recess dinner for students staying on campus.' },
];

// shortcut: fixed -05:00 offset, fine for Nov and Dec fixtures.
const iso = (local: string) => `${local}:00-05:00`;

function gcalUrl(title: string, start: string, end: string | null, place: string | null, details: string): string {
  const fmt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const endIso = end ?? new Date(new Date(start).getTime() + 3600_000).toISOString();
  const p = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${fmt(start)}/${fmt(endIso)}`, details, location: place ?? '' });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export const FIXTURE_EVENTS: EventDetail[] = ROWS.map(function (r) {
  const start = iso(r.start);
  const end = r.end ? iso(r.end) : null;
  const place = r.place ?? null;
  return {
    id: r.id, title: r.title, start, end, allDay: false,
    placeId: null, placeName: place, hostName: r.host ?? null,
    tags: r.tags, freeFood: r.tags.includes('free_food'), food: r.food ?? null,
    audience: r.audience ?? 'open_to_all', college: r.college ?? null,
    status: 'live', updatedFields: [], createdAt: '2026-11-15T12:00:00-05:00',
    summary: r.summary, locationRaw: place, rsvpUrl: r.rsvp ?? null, confidence: 0.95,
    evidence: [], gcalTemplateUrl: gcalUrl(r.title, start, end, place, r.summary),
    source: { id: `src-${r.id}`, kind: 'email', subject: r.title, sender: r.host ?? null, listName: r.host ?? null, receivedAt: '2026-11-15T12:00:00-05:00', rawText: r.summary },
  };
});

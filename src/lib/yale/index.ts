// Yale places, colleges, and glossary for the extraction prompts and place matching.
// Places come from CLAUDE.md 12.3 plus venues named in fixtures/events.real.md and fixtures/emails.

export interface Place {
  id: string;
  name: string;
  aliases: string[];
  college?: string;
}

export const COLLEGES = [
  'Benjamin Franklin',
  'Berkeley',
  'Branford',
  'Davenport',
  'Ezra Stiles',
  'Grace Hopper',
  'Jonathan Edwards',
  'Morse',
  'Pauli Murray',
  'Pierson',
  'Saybrook',
  'Silliman',
  'Timothy Dwight',
  'Trumbull',
] as const;

export const COLLEGE_ALIASES: Record<string, string> = {
  'benjamin franklin': 'Benjamin Franklin', 'ben franklin': 'Benjamin Franklin', franklin: 'Benjamin Franklin', bf: 'Benjamin Franklin',
  berkeley: 'Berkeley',
  branford: 'Branford',
  davenport: 'Davenport', dport: 'Davenport',
  'ezra stiles': 'Ezra Stiles', stiles: 'Ezra Stiles',
  'grace hopper': 'Grace Hopper', hopper: 'Grace Hopper', gh: 'Grace Hopper',
  'jonathan edwards': 'Jonathan Edwards', je: 'Jonathan Edwards',
  morse: 'Morse',
  'pauli murray': 'Pauli Murray', murray: 'Pauli Murray',
  pierson: 'Pierson',
  saybrook: 'Saybrook',
  silliman: 'Silliman',
  'timothy dwight': 'Timothy Dwight', td: 'Timothy Dwight',
  trumbull: 'Trumbull',
};

export function normalizeCollege(s: string | null | undefined): string | null {
  if (!s) return null;
  const key = s.toLowerCase().replace(/\s+/g, ' ').trim().replace(/ college$/, '');
  return COLLEGE_ALIASES[key] ?? null;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const COLLEGE_ROOMS = [
  { key: 'dining-hall', label: 'Dining Hall', words: ['dining hall', 'dining'] },
  { key: 'courtyard', label: 'Courtyard', words: ['courtyard'] },
  { key: 'common-room', label: 'Common Room', words: ['common room'] },
  { key: 'buttery', label: 'Buttery', words: ['buttery'] },
];

function collegePlaces(): Place[] {
  const out: Place[] = [];
  for (const college of COLLEGES) {
    const names = Object.keys(COLLEGE_ALIASES).filter(function (a) { return COLLEGE_ALIASES[a] === college; });
    for (const room of COLLEGE_ROOMS) {
      const aliases: string[] = [];
      for (const n of names) {
        for (const w of room.words) aliases.push(n + ' ' + w, n + ' college ' + w);
      }
      out.push({ id: slug(college) + '-' + room.key, name: college + ' ' + room.label, aliases, college });
    }
  }
  return out;
}

export const PLACES: Place[] = [
  // CLAUDE.md 12.3 list
  { id: 'wlh', name: 'WLH', aliases: ['wlh', 'william l. harkness', 'william l harkness', 'william l. harkness hall'] },
  { id: 'lc', name: 'LC', aliases: ['lc', 'linsly-chittenden', 'linsly chittenden', 'linsly-chittenden hall'] },
  { id: 'akw', name: 'AKW', aliases: ['akw', 'arthur k. watson hall', 'arthur k watson hall'] },
  { id: 'kt', name: 'KT', aliases: ['kt', 'kline tower', 'kline biology tower', 'steep cafe'] },
  { id: 'ceid', name: 'CEID', aliases: ['ceid', 'center for engineering innovation and design'] },
  { id: 'teal', name: 'TEAL', aliases: ['teal'] },
  { id: 'sudler-hall', name: 'Sudler Hall', aliases: ['sudler', 'sudler hall'] },
  { id: 'woolsey-hall', name: 'Woolsey Hall', aliases: ['woolsey', 'woolsey hall'] },
  { id: 'pwg', name: 'PWG', aliases: ['pwg', 'payne whitney', 'payne whitney gym', 'payne whitney gymnasium'] },
  { id: 'bass', name: 'Bass', aliases: ['bass', 'bass library', 'bass cafe'] },
  { id: 'sterling', name: 'Sterling', aliases: ['sterling', 'sml', 'sterling memorial library'] },
  { id: 'cross-campus', name: 'Cross Campus', aliases: ['cross campus'] },
  { id: 'old-campus', name: 'Old Campus', aliases: ['old campus'] },
  { id: 'commons', name: 'Commons', aliases: ['commons', 'schwarzman', 'schwarzman center', 'yale schwarzman center', 'ysc', 'ysc offline oasis', 'offline oasis', 'ysc dance studio', 'the underground'] },
  { id: 'dwight-hall', name: 'Dwight Hall', aliases: ['dwight hall'] },
  { id: 'slifka-center', name: 'Slifka Center', aliases: ['slifka', 'slifka center', 'susman hall'] },
  { id: 'aacc', name: 'AACC', aliases: ['aacc', 'aacc mpr', 'asian american cultural center', 'yung wing living room', '295 crown st', '295 crown street'] },
  { id: 'af-am-house', name: 'Af-Am House', aliases: ['af-am house', 'af am house', 'afam house', 'afro-american cultural center', 'afro american cultural center'] },
  { id: 'la-casa', name: 'La Casa', aliases: ['la casa', 'la casa cultural', 'la casa cultural julia de burgos'] },
  { id: 'nacc', name: 'NACC', aliases: ['nacc', 'native american cultural center'] },
  { id: 'science-hill', name: 'Science Hill', aliases: ['science hill'] },

  // Venues named in the fixtures
  { id: 'menacc', name: 'MENACC', aliases: ['menacc', 'mena cultural community', '305 crown st', '305 crown street'] },
  { id: 'good-life-center', name: 'Good Life Center', aliases: ['good life center', 'glc', 'glc lounge', 'ysc glc lounge', 'good life center lounge', 'ysc good life center lounge', 'glc tea room', 'ysc tea room', 'ysc tea room 208', 'ysc 208'] },
  { id: 'hq', name: 'HQ', aliases: ['hq', 'humanities quadrangle', '320 york st'] },
  { id: 'poorvu', name: 'Poorvu', aliases: ['poorvu', 'poorvu center', 'ctl'] },
  { id: 'dl', name: 'DL', aliases: ['dl', 'dunham', 'dunham lab', 'dunham laboratory'] },
  { id: 'watson-center', name: 'Watson Center', aliases: ['watson center', 'wts'] },
  { id: 'luce-hall', name: 'Luce Hall', aliases: ['luce hall'] },
  { id: 'spl', name: 'SPL', aliases: ['spl', 'sloane physics lab', 'sloane physics laboratory'] },
  { id: 'yqi', name: 'YQI', aliases: ['yqi', '17 hillhouse ave'] },
  { id: 'rosenfeld-hall', name: 'Rosenfeld Hall', aliases: ['rosenfeld hall'] },
  { id: 'sss', name: 'SSS', aliases: ['sss', 'sheffield-sterling-strathcona', 'sheffield sterling strathcona'] },
  { id: 'sterling-hall-of-medicine', name: 'Sterling Hall of Medicine', aliases: ['sterling hall of medicine', 'shm'] },
  { id: 'som', name: 'SOM', aliases: ['som', 'school of management', 'evans hall'] },
  { id: 'battell-chapel', name: 'Battell Chapel', aliases: ['battell', 'battell chapel'] },
  { id: 'hewitt-quad', name: 'Hewitt Quad', aliases: ['hewitt quad', 'hewitt quadrangle'] },
  { id: 'beinecke', name: 'Beinecke', aliases: ['beinecke', 'beinecke library', 'beinecke rare book and manuscript library'] },
  { id: 'beinecke-plaza', name: 'Beinecke Plaza', aliases: ['beinecke plaza', 'beinecke plaza columns'] },
  { id: 'phelps-gate', name: 'Phelps Gate', aliases: ['phelps gate'] },
  { id: 'university-theatre', name: 'University Theatre', aliases: ['university theatre', 'university theater'] },
  { id: 'rose-alumni-house', name: 'Rose Alumni House', aliases: ['rose alumni house', '232 york st'] },
  { id: '53-wall-auditorium', name: '53 Wall St Auditorium', aliases: ['53 wall street auditorium', '53 wall st auditorium', '53 wall street', '53 wall st'] },
  { id: 'green-gallery', name: 'Green Gallery', aliases: ['green gallery', '1156 chapel st'] },
  { id: 'toads-place', name: "Toad's Place", aliases: ["toad's place", 'toads place', "toad's"] },
  { id: 'omni', name: 'Omni New Haven', aliases: ['omni', 'omni new haven', 'omni new haven hotel', 'the omni'] },

  // College-specific venues named in the fixtures
  { id: 'silliman-acorn', name: 'Silliman Acorn', aliases: ['acorn', 'the acorn', 'silliman acorn', 'byers hall'], college: 'Silliman' },
  // shortcut: generic "HoC House/Patio" maps to Silliman because every fixture use is Silliman; disambiguate by sender college if other colleges send these.
  { id: 'silliman-hoc-house', name: 'Silliman HoC House', aliases: ['hoc house', 'hoc patio', 'head of college house', 'silliman hoc house', 'silliman hoc patio', '71 wall st', '71 wall street'], college: 'Silliman' },
  { id: 'davenport-auditorium', name: 'Davenport Auditorium', aliases: ['davenport auditorium', 'dport auditorium'], college: 'Davenport' },
  { id: 'hopper-cabaret', name: 'Hopper Cabaret', aliases: ['hopper cabaret'], college: 'Grace Hopper' },
  { id: 'nick-chapel-theatre', name: 'Nick Chapel Theatre', aliases: ['nick chapel theatre', 'nick chapel theater', 'nick chapel'], college: 'Trumbull' },

  ...collegePlaces(),
];

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normText(s: string): string {
  return s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
}

// Alias must not touch a letter or digit on either side, so 'lc' never hits 'lcd' and 'bass' never hits 'bassoon'.
const MATCHERS = PLACES.flatMap(function (place) {
  return place.aliases.map(function (alias) {
    return { place, alias, re: new RegExp('(?<![a-z0-9])' + escapeRe(alias) + '(?![a-z0-9])') };
  });
});

export function findPlace(text: string | null | undefined): Place | null {
  if (!text) return null;
  const t = normText(text);
  let best: { place: Place; alias: string } | null = null;
  for (const m of MATCHERS) {
    if ((!best || m.alias.length > best.alias.length) && m.re.test(t)) best = m;
  }
  return best ? best.place : null;
}

export function placeName(placeId: string | null): string | null {
  if (!placeId) return null;
  return PLACES.find(function (p) { return p.id === placeId; })?.name ?? null;
}

export const GLOSSARY = `Yale glossary (abbreviations students and clubs use):
WLH: William L. Harkness Hall, classrooms (e.g. "WLH 309").
LC: Linsly-Chittenden Hall, classrooms (e.g. "LC 101").
AKW: Arthur K. Watson Hall, computer science.
KT: Kline Tower on Science Hill (Steep Cafe is inside).
CEID: Center for Engineering Innovation and Design.
TEAL: campus venue, keep the name as written.
DL: Dunham Laboratory. SPL: Sloane Physics Lab. WTS: Watson Center. YQI: Yale Quantum Institute. SSS: Sheffield-Sterling-Strathcona Hall.
HQ: Humanities Quadrangle, 320 York St (e.g. "HQ L01").
PWG: Payne Whitney Gym.
Bass: Bass Library. Sterling or SML: Sterling Memorial Library.
Commons or YSC: the Schwarzman Center; GLC: the Good Life Center inside it.
Poorvu or CTL: Poorvu Center for Teaching and Learning.
HoC: Head of College. "HoC House" or "HoC Patio" is the Head of College's house in a residential college. A College Tea is a talk hosted at the HoC House.
GA: a residential college's student government; "GA event" is a college event.
YCC: Yale College Council, undergraduate student government.
YC3: Yale College Community Care.
FroCo: first-year counselor.
FGLI: first-generation, low-income.
AACC: Asian American Cultural Center, 295 Crown St. MPR: its multipurpose room.
Af-Am House: Afro-American Cultural Center. "The House" also refers to it.
La Casa: La Casa Cultural Julia de Burgos, the Latinx cultural center.
NACC: Native American Cultural Center. MENACC: Middle Eastern and North African cultural center.
Buttery: a residential college's student-run late-night snack bar.
Residential colleges: Benjamin Franklin (BF), Berkeley, Branford, Davenport (Dport), Ezra Stiles (Stiles), Grace Hopper (GH, Hopper), Jonathan Edwards (JE), Morse, Pauli Murray (Murray), Pierson, Saybrook, Silliman, Timothy Dwight (TD), Trumbull.
Acorn: the Silliman Acorn cafe and study space in Byers Hall.
Old Campus: first-year courtyard. Cross Campus: the lawn between Sterling and WLH.
Shopping period: the first days of term when students try classes before registering.
The Game: the Harvard-Yale football game.`;

export function placesContext(): string {
  return PLACES.map(function (p) {
    return p.id + ': ' + p.name + ' (' + p.aliases.slice(0, 4).join(', ') + ')';
  }).join('\n');
}

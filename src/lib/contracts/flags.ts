export const FLAGS = {
  INTRO: 0,
  FEED: 1, FILTERS: 1, GCAL_LINK: 1,
  INGEST: 2, UPLOAD: 2, LIVE_UPDATES: 2, DEMO_PANEL: 2,
  ASK: 3, DEDUP: 3, SOURCE_DRAWER: 3,
  CAL_FEEDS: 4, GCAL_INSERT: 4, ALERTS: 4, DIGEST: 4,
  HOST: 5, TRADITIONS: 5, SALES: 5,
} as const;
export type Flag = keyof typeof FLAGS;

export function isOn(flag: Flag): boolean {
  const maxCp = Number(process.env.NEXT_PUBLIC_MAX_CP ?? 5);
  const off = (process.env.NEXT_PUBLIC_FLAGS_OFF ?? '').split(',').map(function (s) { return s.trim(); });
  return FLAGS[flag] <= maxCp && !off.includes(flag);
}

'use client';

import { isOn, TAGS, type Tag } from '@/lib/contracts';
import { COLLEGES, DEFAULT_FILTERS, TAG_LABELS, type FeedFilters } from '@/lib/client';

const CHIP = 'shrink-0 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00356B] motion-reduce:transition-none';
const ON = 'border-transparent bg-[#00356B] text-white';
const OFF = 'border-zinc-200 text-zinc-700 hover:border-zinc-400';

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={pressed} onClick={onClick} className={`${CHIP} ${pressed ? ON : OFF}`}>
      {children}
    </button>
  );
}

export function FilterBar({ filters, onChange }: { filters: FeedFilters; onChange: (f: FeedFilters) => void }) {
  const active = filters.freeFood || filters.tags.length > 0 || filters.college !== null || Boolean(filters.q);

  function toggleTag(t: Tag) {
    const tags = filters.tags.includes(t) ? filters.tags.filter(function (x) { return x !== t; }) : [...filters.tags, t];
    onChange({ ...filters, tags });
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Range" className="inline-flex self-start rounded-md border border-zinc-200 p-0.5 text-sm">
        {(['today', 'week'] as const).map(function (r) {
          const on = filters.range === r;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={function () { onChange({ ...filters, range: r }); }}
              className={`rounded px-3 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-[#00356B] motion-reduce:transition-none ${on ? 'bg-zinc-100 font-medium text-zinc-900' : 'text-zinc-600 hover:text-zinc-900'}`}
            >
              {r === 'today' ? 'Today' : 'This week'}
            </button>
          );
        })}
      </div>

      {isOn('FILTERS') && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
          <Chip pressed={filters.freeFood} onClick={function () { onChange({ ...filters, freeFood: !filters.freeFood }); }}>
            Free food
          </Chip>
          {TAGS.filter(function (t) { return t !== 'free_food'; }).map(function (t) {
            return <Chip key={t} pressed={filters.tags.includes(t)} onClick={function () { toggleTag(t); }}>{TAG_LABELS[t]}</Chip>;
          })}
          <select
            aria-label="Residential college"
            value={filters.college ?? ''}
            onChange={function (e) { onChange({ ...filters, college: e.target.value || null }); }}
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm text-zinc-700 hover:border-zinc-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00356B]"
          >
            <option value="">All colleges</option>
            {COLLEGES.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
          </select>
          {active && (
            <button
              type="button"
              onClick={function () { onChange({ ...DEFAULT_FILTERS, range: filters.range }); }}
              className="shrink-0 px-2 py-1 text-sm text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline focus-visible:outline-2 focus-visible:outline-[#00356B]"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

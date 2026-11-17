'use client';

import { isOn, TAGS, type Tag } from '@/lib/contracts';
import { COLLEGES, DEFAULT_FILTERS, type FeedFilters } from '@/lib/client';
import { Button, Chip, TAG_LABELS, cn } from '@/components/ui';
import { SubscribeMenu } from './SubscribeMenu';

export function FilterBar({ filters, onChange }: { filters: FeedFilters; onChange: (f: FeedFilters) => void }) {
  const active = filters.freeFood || filters.tags.length > 0 || filters.college !== null || Boolean(filters.q);

  function toggleTag(t: Tag) {
    const tags = filters.tags.includes(t) ? filters.tags.filter(function (x) { return x !== t; }) : [...filters.tags, t];
    onChange({ ...filters, tags });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
      <div role="group" aria-label="Range" className="inline-flex rounded-md border border-line bg-surface p-0.5 text-sm">
        {(['today', 'week'] as const).map(function (r) {
          const on = filters.range === r;
          return (
            <button
              key={r}
              type="button"
              aria-pressed={on}
              onClick={function () { onChange({ ...filters, range: r }); }}
              className={cn('rounded-sm px-3 py-1 transition-colors', on ? 'bg-sunken font-medium text-ink' : 'text-muted hover:text-ink')}
            >
              {r === 'today' ? 'Today' : 'This week'}
            </button>
          );
        })}
      </div>
      <SubscribeMenu />
      </div>

      {isOn('FILTERS') && (
        <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <Chip selected={filters.freeFood} onClick={function () { onChange({ ...filters, freeFood: !filters.freeFood }); }}>
            Free food
          </Chip>
          {TAGS.filter(function (t) { return t !== 'free_food'; }).map(function (t) {
            return <Chip key={t} selected={filters.tags.includes(t)} onClick={function () { toggleTag(t); }}>{TAG_LABELS[t]}</Chip>;
          })}
          <select
            aria-label="Residential college"
            value={filters.college ?? ''}
            onChange={function (e) { onChange({ ...filters, college: e.target.value || null }); }}
            className="h-8 shrink-0 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:border-line-strong"
          >
            <option value="">All colleges</option>
            {COLLEGES.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
          </select>
          {active && (
            <Button variant="ghost" size="sm" onClick={function () { onChange({ ...DEFAULT_FILTERS, range: filters.range }); }}>
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

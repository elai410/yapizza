'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { isOn } from '@/lib/contracts';
import { Button, Card, Chip, EmptyState, Input, Skeleton } from '@/components/ui';
import { EventCard } from '@/components/feed/EventCard';
import { useAsk } from './useAsk';

const EXAMPLES = ['free food tonight', 'career talks this week', 'anything in Davenport'];

export function AskBox({ onOpen, autoFocus = false, initialQuery, examples = true }: { onOpen: (id: string) => void; autoFocus?: boolean; initialQuery?: string; examples?: boolean }) {
  const { ask, data, loading, error, q } = useAsk();
  const [value, setValue] = useState(initialQuery ?? '');

  useEffect(function () {
    if (isOn('ASK') && initialQuery?.trim()) ask(initialQuery.trim());
  }, [initialQuery, ask]);

  if (!isOn('ASK')) return null;

  function run(query: string) {
    const trimmed = query.trim();
    if (!trimmed) return;
    setValue(trimmed);
    ask(trimmed);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    run(value);
  }

  return (
    <div className="space-y-4">
      <form role="search" onSubmit={onSubmit} className="flex gap-2">
        <div className="flex-1">
          <Input
            aria-label="Ask Yapizza"
            placeholder="Free food tonight, career talks this week"
            value={value}
            onChange={function (e) { setValue(e.target.value); }}
            autoFocus={autoFocus}
            leading={<Search aria-hidden className="size-4" />}
          />
        </div>
        <Button type="submit" variant="primary" size="md" className="h-10">Ask</Button>
      </form>

      {examples && !q && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(function (ex) {
            return <Chip key={ex} onClick={function () { run(ex); }}>{ex}</Chip>;
          })}
        </div>
      )}

      {loading ? (
        <div role="status" className="space-y-2">
          <span className="sr-only">Loading</span>
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <EmptyState>Ask is not available right now.</EmptyState>
      ) : data ? (
        <div data-testid="ask-result" className="space-y-3">
          {data.results.length > 0 && (
            <div className="space-y-1">
              {data.answer && <p className="text-[15px] text-ink">{data.answer}</p>}
              <p className="text-xs text-faint">{data.mode === 'grok' ? 'Read by Grok' : 'Showing keyword matches.'}</p>
            </div>
          )}
          {data.results.length === 0 ? (
            <EmptyState>No events match that.</EmptyState>
          ) : (
            <Card className="divide-y divide-line overflow-hidden">
              {[...data.results].sort(function (a, b) { return Date.parse(a.event.start) - Date.parse(b.event.start); }).map(function (r) {
                return (
                  <div key={r.event.id}>
                    <EventCard event={r.event} onOpen={onOpen} showDay />
                    {r.why && <p className="-mt-1 pb-3 pl-[8rem] pr-4 text-sm text-muted">{r.why}</p>}
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}

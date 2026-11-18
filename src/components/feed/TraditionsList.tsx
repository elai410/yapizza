'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import type { TraditionItem } from '@/lib/db/listings';
import { formatWhen } from '@/lib/client';
import { Card, EmptyState, Skeleton } from '@/components/ui';
import { EventSheet } from '@/components/event/EventSheet';

async function fetcher(url: string): Promise<{ traditions: TraditionItem[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`traditions ${res.status}`);
  return res.json();
}

function monthName(m: number | null): string {
  return m && m >= 1 && m <= 12 ? format(new Date(2026, m - 1, 1), 'MMMM') : 'Any time';
}

function Row({ t, onOpen }: { t: TraditionItem; onOpen: (id: string) => void }) {
  const body = (
    <>
      <p className="font-medium text-ink">{t.title}</p>
      {t.hostName ? <p className="text-sm text-muted">{t.hostName}</p> : null}
      {t.notes ? <p className="mt-1 text-sm text-muted">{t.notes}</p> : null}
      {t.next ? (
        <p className="tnum mt-1 text-sm text-ink">Next: {formatWhen(t.next.start, t.next.allDay)}</p>
      ) : (
        <p className="mt-1 text-sm text-muted">Not posted yet this year.</p>
      )}
      {t.yearsSeen.length > 1 ? <p className="tnum mt-1 text-xs text-muted">Seen {t.yearsSeen.join(', ')}</p> : null}
    </>
  );
  const next = t.next;
  if (!next) return <Card className="px-4 py-3">{body}</Card>;
  return (
    <Card className="lift overflow-hidden" data-spot>
      <button
        type="button"
        onClick={function () { onOpen(next.id); }}
        className="block w-full rounded-[inherit] px-4 py-3 text-left focus-visible:outline-offset-[-5px]"
      >
        {body}
      </button>
    </Card>
  );
}

export function TraditionsList() {
  const { data, error, isLoading } = useSWR('/api/traditions', fetcher, { shouldRetryOnError: false });
  const [openId, setOpenId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Card aria-hidden className="mt-6 divide-y divide-line">
        {[0, 1, 2, 3].map(function (i) {
          return (
            <div key={i} className="space-y-2 px-4 py-3">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-1/3" />
            </div>
          );
        })}
      </Card>
    );
  }
  if (error || !data) return <EmptyState>Couldn&apos;t load traditions.</EmptyState>;
  if (data.traditions.length === 0) return <EmptyState data-testid="empty-state">No traditions yet.</EmptyState>;

  // Group by month, Jan to Dec, unknown month last.
  const groups = new Map<number, TraditionItem[]>();
  for (const t of data.traditions) {
    const m = t.typicalMonth && t.typicalMonth >= 1 && t.typicalMonth <= 12 ? t.typicalMonth : 13;
    groups.set(m, [...(groups.get(m) ?? []), t]);
  }
  const months = [...groups.keys()].sort(function (a, b) { return a - b; });

  return (
    <div className="mt-6 space-y-6">
      {months.map(function (m) {
        return (
          <section key={m}>
            <h2 className="mb-2 inline-block rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-wide text-bg">{monthName(m === 13 ? null : m)}</h2>
            <div className="space-y-2">
              {groups.get(m)!.map(function (t) {
                return <Row key={t.id} t={t} onOpen={setOpenId} />;
              })}
            </div>
          </section>
        );
      })}
      <EventSheet id={openId} onClose={function () { setOpenId(null); }} />
    </div>
  );
}

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { ListingItem } from '@/lib/db/listings';
import { formatWhen } from '@/lib/client';
import { Button, Card, EmptyState, Skeleton, cn } from '@/components/ui';

async function fetcher(url: string): Promise<{ listings: ListingItem[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`listings ${res.status}`);
  return res.json();
}

function isFree(price: string | null): boolean {
  if (!price) return true;
  const p = price.trim().toLowerCase().replace(/^\$/, '');
  return p === '' || p === 'free' || Number(p) === 0;
}

function Row({ l }: { l: ListingItem }) {
  const [open, setOpen] = useState(false);
  const long = l.details.length > 140;
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-medium text-ink">{l.title}</p>
        {isFree(l.price) ? (
          <span className="shrink-0 rounded-full bg-food-soft px-2.5 py-0.5 text-sm font-medium text-food">Free</span>
        ) : (
          <span className="tnum shrink-0 rounded-full bg-crust-soft px-2.5 py-0.5 text-sm font-medium text-crust-ink">{l.price}</span>
        )}
      </div>
      {l.details ? <p className={cn('mt-1 text-sm text-muted', !open && 'line-clamp-2')}>{l.details}</p> : null}
      <div className="mt-1 flex items-center gap-2">
        <p className="tnum text-xs text-muted">Posted {formatWhen(l.createdAt).split(' · ')[0]}</p>
        {long ? (
          <Button variant="ghost" size="sm" className="h-6 px-1.5" aria-expanded={open} onClick={function () { setOpen(!open); }}>
            {open ? 'Less' : 'More'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function SalesBoard() {
  const { data, error, isLoading } = useSWR('/api/listings', fetcher, { shouldRetryOnError: false });

  if (isLoading) {
    return (
      <Card aria-hidden className="mt-6 divide-y divide-line">
        {[0, 1, 2].map(function (i) {
          return (
            <div key={i} className="space-y-2 px-4 py-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3.5 w-5/6" />
            </div>
          );
        })}
      </Card>
    );
  }
  if (error || !data) return <EmptyState>Couldn&apos;t load the sales board.</EmptyState>;
  if (data.listings.length === 0) return <EmptyState data-testid="empty-state">Nothing for sale right now.</EmptyState>;

  return (
    <Card className="mt-6 divide-y divide-line">
      {data.listings.map(function (l) {
        return <Row key={l.id} l={l} />;
      })}
    </Card>
  );
}

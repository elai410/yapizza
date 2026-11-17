'use client';

import { useEffect, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarPlus } from 'lucide-react';
import { isOn, TAGS } from '@/lib/contracts';
import { Button, buttonClasses, TAG_LABELS, toast } from '@/components/ui';

const FEEDS: { slug: string; label: string }[] = [
  { slug: 'all', label: 'All events' },
  { slug: 'free-food', label: 'Free food' },
  ...TAGS.filter(function (t) {
    return t !== 'free_food';
  }).map(function (t) {
    return { slug: t, label: TAG_LABELS[t] };
  }),
];

export function SubscribeMenu() {
  // location is client-only; read it after mount to avoid a hydration mismatch.
  const [loc, setLoc] = useState<{ host: string; origin: string } | null>(null);
  useEffect(function () {
    setLoc({ host: window.location.host, origin: window.location.origin });
  }, []);

  if (!isOn('CAL_FEEDS')) return null;

  async function copy(slug: string) {
    if (!loc) return;
    try {
      await navigator.clipboard.writeText(`${loc.origin}/api/feeds/${slug}.ics`);
      toast('Link copied');
    } catch {
      toast('Could not copy the link.');
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button size="sm">
          <CalendarPlus aria-hidden className="size-4" />
          Subscribe
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="end"
          className="z-50 w-80 rounded-lg border border-line bg-surface p-3 shadow-raised"
        >
          <p className="mb-2 text-xs text-muted">Updates as clubs send email.</p>
          <ul className="divide-y divide-line">
            {FEEDS.map(function (f) {
              const gcal = loc
                ? 'https://calendar.google.com/calendar/r?cid=' +
                  encodeURIComponent(`webcal://${loc.host}/api/feeds/${f.slug}.ics`)
                : undefined;
              return (
                <li key={f.slug} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1 truncate text-sm text-ink">{f.label}</span>
                  <a
                    href={gcal}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Add ${f.label} to Google Calendar`}
                    className={buttonClasses({ variant: 'ghost', size: 'sm', className: 'px-2' })}
                  >
                    Add to Google
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2"
                    aria-label={`Copy ${f.label} feed link`}
                    disabled={!loc}
                    onClick={function () {
                      copy(f.slug);
                    }}
                  >
                    Copy link
                  </Button>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

'use client';

import { useEffect, useRef } from 'react';

import { isOn, type EventDetail } from '@/lib/contracts';
import { formatRange, useEvent } from '@/lib/client';
import { Sheet, SheetContent, Skeleton, StatusBadge, TagChip, buttonClasses } from '@/components/ui';
import { AddToCalendar } from './AddToCalendar';
import { SaveButton } from './SaveButton';
import { SourceDrawer } from './SourceDrawer';

const FIELD_WORDS: Record<string, string> = {
  placeId: 'room', placeName: 'room', locationRaw: 'room', start: 'time', end: 'time', title: 'title',
};

function changedLabel(fields: string[]): string {
  return Array.from(new Set(fields.map(function (f) { return FIELD_WORDS[f] ?? f; }))).join(', ');
}

export function EventSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { event, error, isLoading } = useEvent(id);
  // The sheet is controlled with no Trigger, so remember what opened it and hand focus back on close.
  const returnTo = useRef<HTMLElement | null>(null);
  // One view per open (api counts reach from this), not per SWR refetch or dev double effect.
  const counted = useRef<string | null>(null);
  useEffect(function () {
    if (!id) { counted.current = null; return; }
    if (counted.current === id) return;
    counted.current = id;
    void fetch(`/api/events/${encodeURIComponent(id)}/view`, { method: 'POST' }).catch(function () {});
  }, [id]);
  if (id && !returnTo.current && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
    returnTo.current = document.activeElement;
  }

  return (
    <Sheet open={id !== null} onOpenChange={function (open) { if (!open) onClose(); }}>
      <SheetContent
        title={event?.title ?? <span className="sr-only">Event</span>}
        onCloseAutoFocus={function (ev) {
          const el = returnTo.current;
          returnTo.current = null;
          if (el && el.isConnected && el !== document.body) { ev.preventDefault(); el.focus(); }
        }}
      >
        {event ? (
          <Body event={event} />
        ) : error && !isLoading ? (
          <p className="text-sm text-muted">Couldn&apos;t load this event.</p>
        ) : (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({ event: e }: { event: EventDetail }) {
  const place = e.placeName ?? e.locationRaw;
  const when = formatRange(e.start, e.end, e.allDay);

  return (
    <div className="space-y-5">
      <div className="space-y-0.5 text-sm text-muted">
        <p className="tnum text-ink">{when}</p>
        {place && <p>{place}</p>}
        {e.hostName && e.hostName !== place && <p>{e.hostName}</p>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {e.status === 'canceled' && <StatusBadge kind="canceled" />}
        {e.status !== 'canceled' && e.updatedFields.length > 0 && <StatusBadge kind="updated" />}
        {e.tags.map(function (t) { return <TagChip key={t} tag={t} />; })}
        {e.audience === 'members_only' && <span className="self-center text-xs text-muted">Members only</span>}
        {e.audience === 'college_only' && <span className="self-center text-xs text-muted">{e.college ?? 'College'} only</span>}
      </div>

      {e.status !== 'canceled' && e.updatedFields.length > 0 && (
        <p className="text-sm text-update">Changed: {changedLabel(e.updatedFields)}</p>
      )}

      {e.food && <p className="text-sm text-food">Food: {e.food}</p>}
      {e.summary && <p className="text-[15px] leading-relaxed text-ink">{e.summary}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {e.status !== 'canceled' && <AddToCalendar event={e} />}
        {e.status !== 'canceled' && <SaveButton eventId={e.id} />}
        {e.rsvpUrl && (
          <a href={e.rsvpUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses()}>
            RSVP
          </a>
        )}
      </div>

      {isOn('SOURCE_DRAWER') && <SourceDrawer event={e} />}
    </div>
  );
}

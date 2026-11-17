'use client';

import type { EventDetail } from '@/lib/contracts';
import { formatTime, formatWhen, useEvent } from '@/lib/client';
import { Sheet, SheetContent, Skeleton, StatusBadge, TagChip, buttonClasses } from '@/components/ui';
import { AddToCalendar } from './AddToCalendar';

export function EventSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { event, error, isLoading } = useEvent(id);

  return (
    <Sheet open={id !== null} onOpenChange={function (open) { if (!open) onClose(); }}>
      <SheetContent title={event?.title ?? <span className="sr-only">Event</span>}>
        {event ? (
          <Body event={event} />
        ) : error && !isLoading ? (
          <p className="text-sm text-muted">This event could not be loaded.</p>
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
  const when = formatWhen(e.start, e.allDay).split(' · ')[0] + ' · ' + formatTime(e.start, e.end, e.allDay);

  return (
    <div className="space-y-5">
      <div className="space-y-0.5 text-sm text-muted">
        <p className="tnum text-ink">{when}</p>
        {place && <p>{place}</p>}
        {e.hostName && <p>{e.hostName}</p>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {e.status === 'canceled' && <StatusBadge kind="canceled" />}
        {e.status !== 'canceled' && e.updatedFields.length > 0 && <StatusBadge kind="updated" />}
        {e.tags.map(function (t) { return <TagChip key={t} tag={t} />; })}
      </div>

      {e.food && <p className="text-sm text-food">Food: {e.food}</p>}
      {e.summary && <p className="text-[15px] leading-relaxed text-ink">{e.summary}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <AddToCalendar event={e} />
        {e.rsvpUrl && (
          <a href={e.rsvpUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses()}>
            RSVP
          </a>
        )}
      </div>
    </div>
  );
}

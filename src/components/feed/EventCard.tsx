import type { EventCard as EventCardData } from '@/lib/contracts';
import { formatTime } from '@/lib/client';
import { ARRIVE_CLASS, StatusBadge, TagChip, cn } from '@/components/ui';

export function EventCard({ event, onOpen, arrived = false }: { event: EventCardData; onOpen: (id: string) => void; arrived?: boolean }) {
  const canceled = event.status === 'canceled';
  const meta = [event.placeName, event.hostName].filter(Boolean).join(' · ');
  const chips = event.tags.filter(function (t) { return t !== 'free_food'; }).slice(0, 2);

  return (
    <button
      type="button"
      data-testid="event-card"
      data-event-id={event.id}
      onClick={function () { onOpen(event.id); }}
      className={cn('flex w-full gap-4 px-4 py-3 text-left transition-colors hover:bg-sunken', arrived && ARRIVE_CLASS)}
    >
      <span className="tnum w-28 shrink-0 pt-px text-sm text-muted">
        {formatTime(event.start, event.end, event.allDay)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('font-medium text-ink', canceled && 'line-through')}>{event.title}</span>
          {canceled && <StatusBadge kind="canceled" />}
          {!canceled && event.updatedFields.length > 0 && <StatusBadge kind="updated" />}
        </span>
        {meta && <span className="mt-0.5 block truncate text-sm text-muted">{meta}</span>}
        {(chips.length > 0 || event.freeFood) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {event.freeFood && <TagChip tag="free_food" />}
            {chips.map(function (t) { return <TagChip key={t} tag={t} />; })}
          </span>
        )}
      </span>
    </button>
  );
}

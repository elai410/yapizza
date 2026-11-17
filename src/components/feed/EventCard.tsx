import type { EventCard as EventCardData } from '@/lib/contracts';
import { formatTime, formatWhen } from '@/lib/client';
import { ARRIVE_CLASS, StatusBadge, TagChip, cn } from '@/components/ui';

export function EventCard({ event, onOpen, arrived = false, showDay = false }: { event: EventCardData; onOpen: (id: string) => void; arrived?: boolean; showDay?: boolean }) {
  const canceled = event.status === 'canceled';
  const meta = [...new Set([event.placeName, event.hostName].filter(Boolean))].join(' · ');
  const audience = event.audience === 'members_only' ? 'Members only' : event.audience === 'college_only' ? `${event.college ?? 'College'} only` : null;
  const chips = event.tags.filter(function (t) { return t !== 'free_food'; }).slice(0, 2);

  return (
    <button
      type="button"
      data-testid="event-card"
      data-event-id={event.id}
      // Focus first so the sheet can return focus here on close (mouse clicks don't focus buttons in Safari).
      onClick={function (e) { e.currentTarget.focus(); onOpen(event.id); }}
      className={cn('flex w-full gap-4 px-4 py-3 text-left transition-colors hover:bg-sunken', arrived && ARRIVE_CLASS)}
    >
      <span className={cn('tnum shrink-0 pt-px text-sm text-muted', showDay ? 'w-24' : 'w-20')}>
        {showDay && <span className="block text-ink">{formatWhen(event.start).split(' · ')[0]}</span>}
        {formatTime(event.start, null, event.allDay)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={cn('font-medium text-ink', canceled && 'line-through')}>{event.title}</span>
          {canceled && <StatusBadge kind="canceled" />}
          {!canceled && event.updatedFields.length > 0 && <StatusBadge kind="updated" />}
        </span>
        {meta && <span className="mt-0.5 block truncate text-sm text-muted">{meta}</span>}
        {(chips.length > 0 || event.freeFood || audience) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {event.freeFood && (
              <span className="inline-flex h-6 items-center whitespace-nowrap rounded-sm bg-food-soft px-2 text-xs font-medium text-food">
                {event.food ? `Free food · ${event.food}` : 'Free food'}
              </span>
            )}
            {chips.map(function (t) { return <TagChip key={t} tag={t} />; })}
            {audience && <span className="text-xs text-muted">{audience}</span>}
          </span>
        )}
      </span>
    </button>
  );
}

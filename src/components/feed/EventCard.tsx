import type { EventCard as EventCardData } from '@/lib/contracts';
import { formatTime, TAG_LABELS } from '@/lib/client';

export function EventCard({ event, onOpen }: { event: EventCardData; onOpen: (id: string) => void }) {
  const canceled = event.status === 'canceled';
  const meta = [event.placeName, event.hostName].filter(Boolean).join(' · ');
  const chips = event.tags.filter(function (t) { return t !== 'free_food'; }).slice(0, 2);

  return (
    <button
      type="button"
      data-testid="event-card"
      data-event-id={event.id}
      onClick={function () { onOpen(event.id); }}
      className="flex w-full gap-4 px-2 py-3 text-left transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-[#00356B] motion-reduce:transition-none"
    >
      <span className="w-28 shrink-0 pt-px text-sm tabular-nums text-zinc-500">
        {formatTime(event.start, event.end, event.allDay)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className={'font-medium text-zinc-900' + (canceled ? ' line-through' : '')}>{event.title}</span>
          {canceled && <span className="text-xs font-medium text-red-700">Canceled</span>}
          {!canceled && event.updatedFields.length > 0 && <span className="text-xs font-medium text-amber-700">Updated</span>}
        </span>
        {meta && <span className="mt-0.5 block truncate text-sm text-zinc-500">{meta}</span>}
        {(chips.length > 0 || event.freeFood) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {event.freeFood && (
              <span className="inline-flex items-center gap-1.5 font-medium text-green-700">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-green-600" />
                Free food
              </span>
            )}
            {chips.map(function (t) {
              return <span key={t} className="rounded-full border border-zinc-200 px-2 py-0.5 text-zinc-600">{TAG_LABELS[t]}</span>;
            })}
          </span>
        )}
      </span>
    </button>
  );
}

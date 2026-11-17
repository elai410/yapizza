'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { EventDetail } from '@/lib/contracts';
import { formatTime, formatWhen, TAG_LABELS, useEvent } from '@/lib/client';
import { AddToCalendar } from './AddToCalendar';

export function EventSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { event, error, isLoading } = useEvent(id);

  return (
    <Dialog.Root open={id !== null} onOpenChange={function (open) { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none" />
        {/* Bottom sheet below 640px, right side sheet above. Enter-only animation via @starting-style. */}
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-y-auto rounded-t-xl bg-white text-zinc-900 shadow-lg transition-transform duration-200 ease-out starting:translate-y-full focus:outline-none motion-reduce:transition-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-[480px] sm:rounded-none sm:starting:translate-x-full sm:starting:translate-y-0">
          <div className="flex justify-end p-3">
            <Dialog.Close
              aria-label="Close"
              className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00356B]"
            >
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="px-6 pb-8">
            {event ? (
              <Body event={event} />
            ) : (
              <>
                <Dialog.Title className="sr-only">Event</Dialog.Title>
                <Dialog.Description className="sr-only">Event details</Dialog.Description>
                {error && !isLoading ? (
                  <p className="text-sm text-zinc-600">This event could not be loaded.</p>
                ) : (
                  <Skeleton />
                )}
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Body({ event: e }: { event: EventDetail }) {
  const place = e.placeName ?? e.locationRaw;
  const when = formatWhen(e.start, e.allDay).split(' · ')[0] + ' · ' + formatTime(e.start, e.end, e.allDay);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <p className="text-sm text-zinc-600 tabular-nums">{when}</p>
        <Dialog.Title className="text-xl font-semibold leading-snug text-zinc-900">{e.title}</Dialog.Title>
        <Dialog.Description className="space-y-0.5 text-sm text-zinc-600">
          {place && <span className="block">{place}</span>}
          {e.hostName && <span className="block">{e.hostName}</span>}
        </Dialog.Description>
      </div>

      {(e.status === 'canceled' || e.updatedFields.length > 0 || e.freeFood || e.tags.length > 0) && (
        <div className="space-y-2">
          {e.status === 'canceled' && <p className="text-sm font-medium text-red-700">Canceled</p>}
          {e.updatedFields.length > 0 && <p className="text-sm font-medium text-amber-700">Updated</p>}
          {e.freeFood && (
            <p className="text-sm font-medium text-emerald-700">{e.food ? `Free food: ${e.food}` : 'Free food'}</p>
          )}
          {e.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {e.tags.map(function (t) {
                return (
                  <li key={t} className="rounded-full border border-zinc-200 px-2.5 py-0.5 text-xs text-zinc-600">
                    {TAG_LABELS[t]}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {e.summary && <p className="text-sm leading-relaxed text-zinc-800">{e.summary}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <AddToCalendar event={e} />
        {e.rsvpUrl && (
          <a
            href={e.rsvpUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00356B] motion-reduce:transition-none"
          >
            RSVP
          </a>
        )}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3 animate-pulse motion-reduce:animate-none" aria-hidden>
      <div className="h-4 w-1/3 rounded bg-zinc-200" />
      <div className="h-6 w-3/4 rounded bg-zinc-200" />
      <div className="h-4 w-1/2 rounded bg-zinc-200" />
      <div className="h-20 w-full rounded bg-zinc-200" />
    </div>
  );
}

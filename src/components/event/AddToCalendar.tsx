import type { EventDetail } from '@/lib/contracts';
import { isOn } from '@/lib/contracts';

export function AddToCalendar({ event }: { event: Pick<EventDetail, 'gcalTemplateUrl' | 'title'> }) {
  if (!isOn('GCAL_LINK')) return null;
  return (
    <a
      href={event.gcalTemplateUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-md bg-[#00356B] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#002a55] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00356B] motion-reduce:transition-none"
    >
      Add to calendar
    </a>
  );
}

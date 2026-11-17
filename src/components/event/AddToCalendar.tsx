import type { EventDetail } from '@/lib/contracts';
import { isOn } from '@/lib/contracts';
import { buttonClasses } from '@/components/ui';

export function AddToCalendar({ event }: { event: Pick<EventDetail, 'gcalTemplateUrl' | 'title'> }) {
  if (!isOn('GCAL_LINK')) return null;
  return (
    <a href={event.gcalTemplateUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'primary' })}>
      Add to calendar
    </a>
  );
}

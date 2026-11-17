'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { EventDetail } from '@/lib/contracts';
import { formatWhen } from '@/lib/client';
import { StatusBadge, cn } from '@/components/ui';
import { highlightSegments, missingQuotes } from './highlight';

export { highlightSegments } from './highlight';

const KIND_LABEL: Record<EventDetail['source']['kind'], string> = {
  email: 'Email',
  forward: 'Email',
  demo: 'Email',
  upload: 'Upload',
  form: 'Form',
};

const FROM_LABEL: Record<EventDetail['source']['kind'], string> = {
  email: 'From the email', forward: 'From the email', demo: 'From the email', upload: 'From an upload', form: 'From the form',
};

export function SourceDrawer({ event }: { event: EventDetail }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const src = event.source;
  const from = src.sender ?? src.listName;
  const missing = missingQuotes(src.rawText, event.evidence);

  return (
    <div className="border-t border-line pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={function () { setOpen(!open); }}
        className="flex items-center gap-1.5 rounded-sm text-sm font-medium text-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        How this was read
        <ChevronDown
          aria-hidden
          className={cn('size-4 text-muted transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div id={contentId} className="mt-3 space-y-3 rounded-md bg-sunken p-4">
          <div className="space-y-0.5 text-xs text-muted">
            {src.subject && <p>{src.subject}</p>}
            {from && <p>{from}</p>}
            <p className="tnum">{KIND_LABEL[src.kind]} · {formatWhen(src.receivedAt)}</p>
          </div>

          <p className="text-xs font-medium text-muted">{src.kind === 'form' && src.listName ? `From ${src.listName}` : FROM_LABEL[src.kind]}</p>
          <pre className="-mt-2 max-h-80 overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink">
            {highlightSegments(src.rawText, event.evidence).map(function (s, i) {
              return s.hit ? <mark key={i} className="rounded-sm bg-accent-soft px-0.5 text-ink">{s.text}</mark> : s.text;
            })}
          </pre>

          {missing.length > 0 && (
            <div className="text-xs text-cancel">
              <p className="font-medium">Not found in source</p>
              <ul className="mt-0.5 space-y-0.5">
                {missing.map(function (q, i) { return <li key={i}>“{q}”</li>; })}
              </ul>
            </div>
          )}

          {event.status === 'review' && <StatusBadge kind="review" />}

          {event.readBy === 'grok' ? (
            <p className="text-xs text-faint">
              Read by Grok · confidence <span className="tnum">{event.confidence.toFixed(2)}</span>
            </p>
          ) : event.evidence.length > 0 ? (
            <p className="text-xs text-faint">Quotes checked against the {src.kind === 'upload' ? 'file' : src.kind === 'form' ? 'listing' : 'email'}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}

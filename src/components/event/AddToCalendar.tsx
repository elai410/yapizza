'use client';

import { useState } from 'react';
import type { EventDetail, GcalInsertResponse } from '@/lib/contracts';
import { isOn } from '@/lib/contracts';
import { useSession } from '@/lib/client';
import { Button, buttonClasses, toast } from '@/components/ui';

// Signed in with GCAL_INSERT on: insert straight into the student's calendar.
// Otherwise, or if the insert fails: the Google Calendar template link, which needs no sign-in.
export function AddToCalendar({ event }: { event: Pick<EventDetail, 'id' | 'gcalTemplateUrl' | 'title'> }) {
  const { user } = useSession();
  const [busy, setBusy] = useState(false);
  if (!isOn('GCAL_LINK')) return null;

  if (!isOn('GCAL_INSERT') || !user) {
    return (
      <a href={event.gcalTemplateUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'primary' })}>
        Add to calendar
      </a>
    );
  }

  async function insert() {
    setBusy(true);
    try {
      const res = await fetch('/api/gcal/insert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId: event.id }) });
      if (!res.ok) throw new Error(String(res.status));
      const r = (await res.json()) as GcalInsertResponse;
      toast('Added to calendar', { action: { label: 'View', onClick: function () { window.open(r.link, '_blank', 'noopener'); } } });
    } catch {
      window.open(event.gcalTemplateUrl, '_blank', 'noopener');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="primary" onClick={insert} disabled={busy}>
      Add to calendar
    </Button>
  );
}

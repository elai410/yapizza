'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { isOn } from '@/lib/contracts';
import { useSession } from '@/lib/client';
import { Button } from '@/components/ui';

// Saves are per student (api gates them on GCAL_INSERT). Signed out, Save first asks who you are.
export function SaveButton({ eventId }: { eventId: string }) {
  const { user, students, signIn } = useSession();
  const { data, mutate } = useSWR<{ eventIds: string[] }>(user ? '/api/saves' : null, async function (url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  });
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!isOn('GCAL_INSERT')) return null;

  const saved = data?.eventIds.includes(eventId) ?? false;

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch('/api/saves', { method: saved ? 'DELETE' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventId }) });
      if (res.ok) await mutate();
    } finally {
      setBusy(false);
    }
  }

  if (!user && picking) {
    return (
      <select
        aria-label="Student"
        defaultValue=""
        onChange={async function (e) { if (e.target.value) { await signIn(e.target.value); setPicking(false); } }}
        className="h-9 rounded-md border border-line-strong bg-surface px-3 text-sm text-ink"
      >
        <option value="" disabled>Sign in as</option>
        {students.map(function (s) { return <option key={s.id} value={s.id}>{s.name}{s.college ? ` · ${s.college}` : ''}</option>; })}
      </select>
    );
  }

  return (
    <Button aria-pressed={saved} onClick={user ? toggle : function () { setPicking(true); }} disabled={busy}>
      {saved ? 'Saved' : 'Save'}
    </Button>
  );
}

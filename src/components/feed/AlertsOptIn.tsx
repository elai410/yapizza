'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import useSWR from 'swr';
import { isOn, type AlertsSubscribeRequest, type OkResponse } from '@/lib/contracts';
import Link from 'next/link';
import { Button, Card, Input, toast } from '@/components/ui';

const KEY = 'yapizza.alerts';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Outbox = { notifications: { id: string; to: string; subject: string; eventId: string | null; sentAt: string }[] };

// In-app copy of alert emails: poll the outbox (integrations) and toast new rows sent to this student's address.
function useAlertToasts(onFor: string | null, onOpen?: (id: string) => void) {
  const since = useRef(Date.now());
  const seen = useRef(new Set<string>());
  const { data } = useSWR<Outbox>(onFor && isOn('ALERTS') ? '/api/demo/outbox' : null, async function (url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  }, { refreshInterval: 3000 });
  useEffect(function () {
    for (const n of data?.notifications ?? []) {
      if (seen.current.has(n.id) || n.to !== onFor || new Date(n.sentAt).getTime() < since.current) continue;
      seen.current.add(n.id);
      const eventId = n.eventId;
      toast(n.subject, eventId && onOpen ? { action: { label: 'View', onClick: function () { onOpen(eventId); } } } : undefined);
    }
  }, [data, onFor, onOpen]);
}

export function AlertsOptIn({ onOpen }: { onOpen?: (id: string) => void } = {}) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [onFor, setOnFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(function () {
    try {
      setOnFor(localStorage.getItem(KEY));
    } catch {}
  }, []);
  useAlertToasts(onFor, onOpen);

  if (!isOn('ALERTS')) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const target = email.trim();
    if (!EMAIL.test(target)) {
      setError('Enter a valid email.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const body: AlertsSubscribeRequest = { channel: 'email', target, freeFood: true };
      const res = await fetch('/api/alerts/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = res.ok ? ((await res.json()) as OkResponse) : null;
      if (!data?.ok) throw new Error('subscribe failed');
      setOnFor(target);
      try {
        localStorage.setItem(KEY, target);
      } catch {}
    } catch {
      setError('Alerts are not available right now.');
    } finally {
      setSending(false);
    }
  }

  async function turnOff() {
    if (onFor) {
      const body: AlertsSubscribeRequest = { channel: 'email', target: onFor, freeFood: false };
      await fetch('/api/alerts/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(function () {});
    }
    setOnFor(null);
    setEmail('');
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-ink">Free food alerts</p>
        {isOn('DIGEST') && <Link href="/digest" className="text-sm text-accent hover:underline">Sunday digest</Link>}
      </div>
      {onFor ? (
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-sm text-muted" role="status">
            Alerts on for {onFor}.
          </p>
          <Button variant="ghost" size="sm" onClick={turnOff}>
            Turn off
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-1">
          <p className="text-sm text-muted">Get an email when free food is posted.</p>
          <label htmlFor={id} className="mt-3 block text-xs font-medium text-muted">
            Email
          </label>
          <div className="mt-1 flex gap-2">
            <Input
              id={id}
              type="email"
              autoComplete="email"
              value={email}
              onChange={function (e) {
                setEmail(e.target.value);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-err` : undefined}
              className="h-8 text-sm"
            />
            <Button type="submit" variant="primary" size="sm" disabled={sending}>
              Turn on
            </Button>
          </div>
          {error ? (
            <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs text-cancel">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </Card>
  );
}

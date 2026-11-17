'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { isOn, type AlertsSubscribeRequest, type OkResponse } from '@/lib/contracts';
import { Button, Card, Input } from '@/components/ui';

const KEY = 'yapizza.alerts';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AlertsOptIn() {
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

  function undo() {
    setOnFor(null);
    setEmail('');
    try {
      localStorage.removeItem(KEY);
    } catch {}
  }

  return (
    <Card className="p-4">
      <p className="text-sm font-medium text-ink">Free food alerts</p>
      {onFor ? (
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-sm text-muted" role="status">
            Alerts on for {onFor}.
          </p>
          <Button variant="ghost" size="sm" onClick={undo}>
            Undo
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-1">
          <p className="text-sm text-muted">Get an email when free food is posted near you.</p>
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

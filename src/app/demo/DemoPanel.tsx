'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { IngestResult, IntegrationStatus } from '@/lib/contracts';
import { Button, Card, Textarea, cn } from '@/components/ui';

export interface FixtureEmail {
  file: string;
  subject: string;
  from: string;
}

interface Outcome {
  ok: boolean;
  detail: string;
  result?: IngestResult;
}

interface LogRow extends Outcome {
  id: number;
  time: string;
  action: string;
  rtt: number;
}

const DEFAULT_EMAIL = '34-yums-weekly-nov-16.json';
const DEFAULT_FLYER = 'helix-langer-flyer.png';
const LINKS = ['/', '/sim/inbox', '/sim/outbox', '/host/upload'];
const SELECT =
  'h-9 w-full min-w-0 rounded-md border border-line-strong bg-surface px-2 text-sm text-ink focus:border-accent';

function isIngest(x: unknown): x is IngestResult {
  return typeof x === 'object' && x !== null && Array.isArray((x as IngestResult).created) && typeof (x as IngestResult).ms === 'number';
}

// Turns any response into an Outcome; a 404 means the other session hasn't landed the route yet.
async function toOutcome(res: Response): Promise<Outcome> {
  if (res.status === 404) return { ok: false, detail: 'not built yet' };
  const body: unknown = await res.json().catch(function () { return null; });
  const b = (body ?? {}) as { ok?: boolean; detail?: unknown; error?: string; result?: unknown };
  // IngestResult arrives as the body (upload), in `result` (demo routes), or in `detail` (older demo shape).
  const result = [body, b.result, b.detail].find(isIngest);
  const ok = res.ok && b.ok !== false && !b.error;
  const detail = typeof b.detail === 'string' ? b.detail : b.error ?? (ok ? '' : `HTTP ${res.status}`);
  return { ok, detail, result };
}

function post(url: string, body: unknown): Promise<Outcome> {
  return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(toOutcome);
}

export function DemoPanel({ emails: diskEmails, flyers }: { emails: FixtureEmail[]; flyers: string[] }) {
  // The disk list is a fallback; /api/demo/emails also includes the human's real emails (fixtures/emails/real).
  const [emails, setEmails] = useState(diskEmails);
  const [status, setStatus] = useState<IntegrationStatus | null | 'error'>(null);
  const [log, setLog] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState<Record<number, boolean>>({});
  const [fixture, setFixture] = useState(emails.some(function (e) { return e.file === DEFAULT_EMAIL; }) ? DEFAULT_EMAIL : emails[0]?.file ?? '');
  const [pasteOn, setPasteOn] = useState(false);
  const [paste, setPaste] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [flyer, setFlyer] = useState(flyers.includes(DEFAULT_FLYER) ? DEFAULT_FLYER : flyers[0] ?? '');
  const nextId = useRef(0);

  useEffect(function () {
    let alive = true;
    function load() {
      fetch('/api/integrations/status', { cache: 'no-store' })
        .then(function (r) { return r.ok ? (r.json() as Promise<IntegrationStatus>) : Promise.reject(r.status); })
        .then(function (s) { if (alive) setStatus(s); })
        .catch(function () { if (alive) setStatus('error'); });
    }
    load();
    const t = setInterval(load, 10_000);
    return function () { alive = false; clearInterval(t); };
  }, []);

  useEffect(function () {
    fetch('/api/demo/emails', { cache: 'no-store' })
      .then(function (r) { return r.ok ? (r.json() as Promise<{ emails: FixtureEmail[] }>) : Promise.reject(r.status); })
      .then(function (b) { if (b.emails.length > 0) setEmails(b.emails); })
      .catch(function () {});
  }, []);

  async function run(n: number, action: string, fn: () => Promise<Outcome | null>) {
    if (busy[n]) return;
    setBusy(function (b) { return { ...b, [n]: true }; });
    const t0 = performance.now();
    let out: Outcome | null;
    try {
      out = await fn();
    } catch (err) {
      out = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    }
    const rtt = Math.round(performance.now() - t0);
    setBusy(function (b) { return { ...b, [n]: false }; });
    if (!out) return; // cancelled before sending
    const row: LogRow = { ...out, id: nextId.current++, action, rtt, time: new Date().toLocaleTimeString('en-GB', { hour12: false }) };
    setLog(function (l) { return [row, ...l].slice(0, 50); });
  }

  const actions: Record<number, () => void> = {
    1: function () {
      run(1, 'Send club email', async function () {
        if (!pasteOn) return post('/api/demo/send-email', { fixture });
        let email: unknown;
        try {
          email = JSON.parse(paste);
        } catch (err) {
          setPasteError(err instanceof Error ? err.message : 'Invalid JSON');
          return null;
        }
        setPasteError(null);
        return post('/api/demo/send-email', { email });
      });
    },
    2: function () { run(2, 'Send room change', function () { return post('/api/demo/room-change', {}); }); },
    3: function () {
      run(3, `Upload flyer ${flyer}`, async function () {
        const f = await fetch(`/demo/flyer/${encodeURIComponent(flyer)}`);
        if (!f.ok) return { ok: false, detail: `flyer ${flyer} not found` };
        const blob = await f.blob();
        const form = new FormData();
        form.append('file', new File([blob], flyer, { type: blob.type }));
        return toOutcome(await fetch('/api/upload', { method: 'POST', body: form }));
      });
    },
    4: function () { run(4, 'Free food now', function () { return post('/api/demo/free-food-now', {}); }); },
    5: function () {
      if (!window.confirm('Reset the demo? This clears ingested events, the sim inbox and outbox.')) return;
      run(5, 'Reset demo', function () { return post('/api/demo/reset', {}); });
    },
    6: function () {
      run(6, 'Record Grok replay', async function () {
        const copied = await navigator.clipboard.writeText('pnpm grok:record').then(function () { return true; }, function () { return false; });
        return { ok: true, detail: `Run pnpm grok:record in a terminal${copied ? ' (copied)' : ''}` };
      });
    },
  };
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(function () {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      const fn = actionsRef.current[Number(e.key)];
      if (!fn) return;
      e.preventDefault();
      fn();
    }
    window.addEventListener('keydown', onKey);
    return function () { window.removeEventListener('keydown', onKey); };
  }, []);

  // A plain render helper, not a component: a nested component would remount and drop focus on each render.
  function actionButton(n: number, label: string) {
    return (
      <Button
        variant={n === 1 || n === 3 ? 'primary' : 'secondary'}
        size="sm"
        className="w-44 shrink-0 justify-between"
        data-testid={`demo-action-${n}`}
        aria-keyshortcuts={String(n)}
        disabled={busy[n]}
        onClick={actions[n]}
      >
        <span>{busy[n] ? 'Working' : label}</span>
        <kbd className="tnum rounded border border-current/30 px-1.5 text-[11px] font-normal opacity-80">{n}</kbd>
      </Button>
    );
  }

  const services: [string, string][] =
    status && status !== 'error'
      ? [['Grok', status.grok], ['Gmail', status.gmail], ['Calendar', status.gcal], ['Notify', status.notify], ['Auth', status.auth]]
      : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold text-ink">Demo panel</h1>
        <nav aria-label="Demo links" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LINKS.map(function (href) {
            return <Link key={href} href={href} className="text-accent underline-offset-2 hover:underline">{href}</Link>;
          })}
        </nav>
      </div>

      <Card className="px-4 py-3" data-testid="demo-status">
        <h2 className="sr-only">Integration status</h2>
        {status === null && <p className="text-sm text-muted">Loading status</p>}
        {status === 'error' && <p className="text-sm text-cancel">Status unavailable: GET /api/integrations/status failed</p>}
        {services.length > 0 && (
          <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            {services.map(function ([name, mode]) {
              return (
                <div key={name} className="flex items-center gap-1.5">
                  <dt className="text-muted">{name}</dt>
                  <dd className={cn('rounded px-1.5 py-0.5 text-xs font-medium', mode === 'sim' ? 'bg-sunken text-muted' : 'bg-accent-soft text-accent')}>{mode}</dd>
                </div>
              );
            })}
            {status !== 'error' && status?.forcedSim && (
              <div className="rounded bg-update-soft px-1.5 py-0.5 text-xs font-medium text-update">Forced sim</div>
            )}
          </dl>
        )}
      </Card>

      <Card className="divide-y divide-line">
        <h2 className="sr-only">Actions</h2>
        <div className="flex flex-col gap-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            {actionButton(1, 'Send club email')}
            {!pasteOn && (
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <span className="sr-only">Fixture email</span>
                <select className={SELECT} value={fixture} onChange={function (e) { setFixture(e.target.value); }}>
                  {emails.map(function (e) {
                    return <option key={e.file} value={e.file}>{e.file.startsWith('real/') ? 'Real' : e.file.slice(0, 2)} {e.subject}</option>;
                  })}
                </select>
              </label>
            )}
            <label className="flex items-center gap-1.5 text-sm text-muted">
              <input type="checkbox" checked={pasteOn} onChange={function (e) { setPasteOn(e.target.checked); setPasteError(null); }} className="accent-accent" />
              Paste
            </label>
          </div>
          {pasteOn && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">RawEmail JSON, or just subject and text</span>
              <Textarea
                value={paste}
                onChange={function (e) { setPaste(e.target.value); }}
                className="min-h-40 font-mono text-[13px]"
                aria-invalid={pasteError ? true : undefined}
                aria-describedby={pasteError ? 'paste-error' : undefined}
                placeholder='{ "subject": "...", "text": "...", "from": "..." }'
              />
              {pasteError && <span id="paste-error" className="text-cancel">{pasteError}</span>}
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {actionButton(2, 'Send room change')}
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {actionButton(3, 'Upload flyer')}
          <label className="flex min-w-0 flex-1 items-center text-sm">
            <span className="sr-only">Flyer file</span>
            <select className={SELECT} value={flyer} onChange={function (e) { setFlyer(e.target.value); }}>
              {flyers.map(function (f) { return <option key={f} value={f}>{f}</option>; })}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {actionButton(4, 'Free food now')}
          {actionButton(5, 'Reset demo')}
          {actionButton(6, 'Record Grok replay')}
        </div>
      </Card>

      <section aria-labelledby="demo-log-h">
        <h2 id="demo-log-h" className="mb-2 text-sm font-medium text-muted">Log</h2>
        <Card className="overflow-x-auto">
          <ol data-testid="demo-log" aria-live="polite" className="divide-y divide-line text-sm">
            {log.length === 0 && <li className="px-4 py-3 text-muted">No actions yet.</li>}
            {log.map(function (row) {
              const r = row.result;
              const titles = r ? [...r.created, ...r.updated].map(function (c) { return c.title; }) : [];
              return (
                <li key={row.id} className="grid grid-cols-[4.5rem_10rem_3.5rem_4.5rem_1fr] gap-3 px-4 py-2 max-sm:grid-cols-[4.5rem_1fr_3.5rem]">
                  <span className="tnum text-muted">{row.time}</span>
                  <span className="text-ink">{row.action}</span>
                  <span className={row.ok ? 'text-food' : 'text-cancel'}>{row.ok ? 'ok' : 'failed'}</span>
                  <span className="tnum text-muted">{row.rtt} ms</span>
                  <span className="min-w-0 text-muted max-sm:col-span-3">
                    {r && (
                      <span className="tnum text-ink">
                        server {r.ms} ms · {r.created.length} new · {r.updated.length} updated · {r.inReview} review
                      </span>
                    )}
                    {r && row.detail && ' · '}
                    {row.detail}
                    {r?.stages && (
                      <span className="tnum block">
                        {Object.entries(r.stages).map(([stage, ms]) => `${stage} ${ms} ms`).join(' · ')}
                      </span>
                    )}
                    {titles.length > 0 && <span className="block truncate">{titles.join(' / ')}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      </section>
    </div>
  );
}

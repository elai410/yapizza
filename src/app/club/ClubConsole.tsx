'use client';

import { useEffect, useRef, useState, type DragEvent } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { Check, Copy, FileImage, FileText, Mail, Upload } from 'lucide-react';
import { isOn, type EventDetail, type IngestResult } from '@/lib/contracts';
import { formatWhen } from '@/lib/client';
import { highlightSegments } from '@/components/event/highlight';
import { EventSheet } from '@/components/event/EventSheet';
import { EventCard } from '@/components/feed/EventCard';
import { ARRIVE_CLASS, Button, Card, Input, Skeleton, Textarea, buttonClasses, cn } from '@/components/ui';

export interface Sample { label: string; from: string; subject: string; listName: string; text: string; sentAt: string }

interface Extracted { id: string; title: string; start: string; status: string; readBy: string; confidence: number; evidence: string[] }
interface LogRow {
  id: string; kind: string; subject: string | null; from: string | null; receivedAt: string; status: string; error: string | null;
  rawText: string; listings: number; created: Extracted[]; updated: { id: string; title: string; changedFields: string[] }[];
}
interface Recent { intake: string | null; log: LogRow[] }

const STEPS = [
  { key: 'received', label: 'Received' },
  { key: 'extracted', label: 'Read by Claude' },
  { key: 'checked', label: 'Quotes checked' },
  { key: 'matched', label: 'Duplicates matched' },
  { key: 'saved', label: 'Published' },
] as const;

const FIELD_LABEL: Record<string, string> = { placeId: 'room', locationRaw: 'room', start: 'time', end: 'time', title: 'title', status: 'status' };

type Run =
  | { phase: 'idle' }
  | { phase: 'running'; step: number; what: string }
  | { phase: 'done'; what: string; result: IngestResult; details: EventDetail[] }
  | { phase: 'error'; what: string; message: string };

const fetcher = function (u: string) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Recent>; }); };

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return formatWhen(iso).split(' · ')[0];
}

export function ClubConsole({ samples, sampleFlyer }: { samples: Sample[]; sampleFlyer: string | null }) {
  const { data, mutate } = useSWR('/api/club/recent', fetcher, { refreshInterval: 3000 });
  const [run, setRun] = useState<Run>({ phase: 'idle' });
  const [openId, setOpenId] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // While the request is out, walk the steps up to "Duplicates matched"; the real result finishes them.
  useEffect(function () {
    if (run.phase !== 'running') return;
    const t = setInterval(function () {
      setRun(function (r) { return r.phase === 'running' && r.step < 3 ? { ...r, step: r.step + 1 } : r; });
    }, 650);
    return function () { clearInterval(t); };
  }, [run.phase]);

  async function send(what: string, request: () => Promise<Response>) {
    setRun({ phase: 'running', step: 0, what });
    resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const res = await request();
      const body = (await res.json().catch(function () { return null; })) as (IngestResult & { error?: string }) | null;
      if (!res.ok || !body || body.error) throw new Error(body?.error ?? `Request failed (${res.status})`);
      const ids = [...body.created, ...body.updated].map(function (e) { return e.id; });
      const details = (
        await Promise.all(ids.map(function (id) { return fetch(`/api/events/${id}`).then(function (r) { return r.ok ? (r.json() as Promise<EventDetail>) : null; }); }))
      ).filter(function (d): d is EventDetail { return d !== null; });
      setRun({ phase: 'done', what, result: body, details });
    } catch (err) {
      setRun({ phase: 'error', what, message: err instanceof Error ? err.message : String(err) });
    }
    void mutate();
  }

  function sendFile(file: File) {
    const body = new FormData();
    body.set('file', file);
    void send(file.name, function () { return fetch('/api/upload', { method: 'POST', body }); });
  }

  function sendEmail(e: { from: string; subject: string; listName: string; text: string; sentAt?: string }) {
    void send(e.subject || 'Your email', function () {
      return fetch('/api/ingest/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messageId: `club-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          from: e.from || `${e.listName || 'Club'} <list@lists.yale.test>`,
          to: [],
          subject: e.subject,
          text: e.text,
          listName: e.listName || undefined,
          sentAt: e.sentAt ?? new Date().toISOString(),
        }),
      });
    });
  }

  const busy = run.phase === 'running';

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-sauce uppercase">For clubs</p>
          <h1 className="mt-1 text-4xl font-extrabold text-ink sm:text-5xl">Send it once.</h1>
          <p className="mt-2 max-w-md text-[15px] text-muted">Add one address to your list, or drop in a flyer. Claude reads it and students see the event in seconds.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <IntakeAddress address={data?.intake ?? null} loading={!data} />
          {isOn('HOST') && <Link href="/host" className="draw text-sm font-semibold text-accent">Manage your events</Link>}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <FlyerDrop disabled={busy} onFile={sendFile} sampleFlyer={sampleFlyer} />
        <EmailPaste disabled={busy} samples={samples} onSend={sendEmail} />
      </div>

      <div ref={resultRef} className="scroll-mt-[calc(var(--header-h)+16px)]">
        {run.phase !== 'idle' && (
          <Pipeline
            run={run}
            onOpen={setOpenId}
            sentText={run.phase === 'done' ? data?.log.find(function (r) { return r.id === run.result.sourceId; })?.rawText : undefined}
          />
        )}
      </div>

      <section aria-labelledby="recent-h" className="mt-12">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="recent-h" className="text-2xl font-bold text-ink">Recent mail</h2>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="size-2 animate-pulse rounded-full bg-food" aria-hidden />
            Live
          </span>
        </div>
        <RecentList log={data?.log} />
      </section>

      <EventSheet id={openId} onClose={function () { setOpenId(null); }} />
    </div>
  );
}

function IntakeAddress({ address, loading }: { address: string | null; loading: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <Card className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">Add this to your list</p>
        {loading ? (
          <Skeleton className="mt-1 h-5 w-48" />
        ) : (
          <p className="truncate font-mono text-sm font-semibold text-ink">{address ?? 'Set GMAIL_INTAKE_ADDRESS'}</p>
        )}
      </div>
      {address && (
        <Button
          size="sm"
          aria-label="Copy intake address"
          onClick={function () {
            void navigator.clipboard?.writeText(address).then(function () { setCopied(true); setTimeout(function () { setCopied(false); }, 1500); });
          }}
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      )}
    </Card>
  );
}

function FlyerDrop({ disabled, onFile, sampleFlyer }: { disabled: boolean; onFile: (f: File) => void; sampleFlyer: string | null }) {
  const [over, setOver] = useState(false);
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f && !disabled) onFile(f);
  }
  async function useSample() {
    if (!sampleFlyer) return;
    const blob = await fetch(sampleFlyer).then(function (r) { return r.blob(); });
    onFile(new File([blob], 'helix-langer-flyer.png', { type: blob.type || 'image/png' }));
  }
  return (
    <Card className="flex flex-col p-5">
      <h2 className="text-xl font-bold text-ink">Drop a flyer</h2>
      <p className="mt-1 text-sm text-muted">Photo, PDF, spreadsheet or calendar file.</p>
      <label
        onDragOver={function (e) { e.preventDefault(); setOver(true); }}
        onDragLeave={function () { setOver(false); }}
        onDrop={onDrop}
        className={cn(
          'press mt-4 flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-10 text-center transition-colors',
          over ? 'border-accent bg-accent-soft' : 'border-line-strong bg-bg hover:border-ink hover:bg-crust-soft',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <span className="flex size-12 items-center justify-center rounded-full border-2 border-ink bg-crust shadow-pop-sm">
          <Upload size={20} aria-hidden />
        </span>
        <span className="text-sm font-semibold text-ink">Drop it here or choose a file</span>
        <input
          type="file"
          className="sr-only"
          accept="image/png,image/jpeg,application/pdf,text/csv,.csv,text/calendar,.ics"
          disabled={disabled}
          onChange={function (e) { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
        />
      </label>
      {sampleFlyer && (
        <Button className="mt-3 self-start" size="sm" disabled={disabled} onClick={function () { void useSample(); }}>
          <FileImage size={14} aria-hidden />Use a sample flyer
        </Button>
      )}
    </Card>
  );
}

function EmailPaste({ disabled, samples, onSend }: { disabled: boolean; samples: Sample[]; onSend: (e: Sample | { from: string; subject: string; listName: string; text: string }) => void }) {
  const [listName, setListName] = useState('');
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');
  const [from, setFrom] = useState('');
  const [sentAt, setSentAt] = useState<string | undefined>(undefined);
  return (
    <Card className="p-5">
      <h2 className="text-xl font-bold text-ink">Paste an email</h2>
      <p className="mt-1 text-sm text-muted">Or forward it to the address above.</p>
      {samples.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Sample emails">
          {samples.map(function (s) {
            return (
              <button
                key={s.label}
                type="button"
                disabled={disabled}
                onClick={function () { setListName(s.listName); setSubject(s.subject); setText(s.text); setFrom(s.from); setSentAt(s.sentAt); }}
                className="press inline-flex h-7 items-center rounded-full border-2 border-line-strong bg-surface px-2.5 text-xs font-semibold text-ink hover:border-ink"
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}
      <form
        className="mt-3 space-y-2"
        onSubmit={function (e) { e.preventDefault(); if (text.trim()) onSend({ from, subject, listName, text, ...(sentAt ? { sentAt } : {}) } as Sample); }}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Input aria-label="List name" placeholder="List name" value={listName} onChange={function (e) { setListName(e.target.value); setFrom(''); setSentAt(undefined); }} />
          <Input aria-label="Subject" placeholder="Subject" value={subject} onChange={function (e) { setSubject(e.target.value); }} />
        </div>
        <Textarea aria-label="Email text" placeholder="Paste the email here" className="min-h-32" value={text} onChange={function (e) { setText(e.target.value); setSentAt(undefined); }} />
        <button type="submit" disabled={disabled || !text.trim()} className={buttonClasses({ variant: 'primary' })}>
          <Mail size={15} aria-hidden />Send to Yapizza
        </button>
      </form>
    </Card>
  );
}

function Pipeline({ run, onOpen, sentText }: { run: Exclude<Run, { phase: 'idle' }>; onOpen: (id: string) => void; sentText?: string }) {
  const done = run.phase === 'done' ? run : null;
  const stages = done?.result.stages;
  const readByRules = done?.details.some(function (d) { return d.readBy === 'rules'; });
  const active = run.phase === 'running' ? run.step : run.phase === 'done' ? STEPS.length : -1;
  const cards = done ? [...done.result.created, ...done.result.updated] : [];
  const updatedIds = new Set(done?.result.updated.map(function (e) { return e.id; }) ?? []);
  const rawText = done?.details[0]?.source.rawText ?? sentText;
  const quotes = done?.details.flatMap(function (d) { return d.evidence; }) ?? [];

  return (
    <section aria-labelledby="run-h" aria-live="polite" className="mt-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="run-h" className="text-2xl font-bold text-ink">{run.phase === 'running' ? 'Reading it now' : run.phase === 'error' ? 'That one failed' : 'Here it is'}</h2>
        <span className="truncate text-sm text-muted">{run.what}{done ? ` · ${(done.result.ms / 1000).toFixed(1)}s` : ''}</span>
      </div>

      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-5">
        {STEPS.map(function (s, i) {
          const state = run.phase === 'error' ? (i === 0 ? 'done' : 'off') : i < active ? 'done' : i === active ? 'now' : 'off';
          const ms = stages?.[s.key];
          const label = s.key === 'extracted' && readByRules ? 'Read by backup rules' : s.label;
          return (
            <li
              key={s.key}
              className={cn(
                'flex items-center gap-2.5 rounded-md border-2 px-3 py-2.5 text-sm font-semibold transition-colors duration-300',
                state === 'done' && 'border-ink bg-accent text-accent-ink shadow-pop-sm',
                state === 'now' && 'border-ink bg-crust text-ink shadow-pop-sm',
                state === 'off' && 'border-line-strong bg-surface text-muted',
              )}
            >
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs', state === 'done' ? 'bg-white text-accent' : 'border-2 border-current')}>
                {state === 'done' ? <Check size={13} strokeWidth={3} aria-hidden /> : state === 'now' ? <span className="size-2 animate-ping rounded-full bg-ink" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block leading-tight">{label}</span>
                {typeof ms === 'number' && <span className="tnum block text-xs font-medium opacity-80">{ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`}</span>}
              </span>
            </li>
          );
        })}
      </ol>

      {run.phase === 'error' && <Card className="mt-4 p-4 text-sm text-cancel">{run.message}</Card>}

      {done && (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="min-w-0 p-4">
            <h3 className="mb-2 text-sm font-bold text-ink">What you sent</h3>
            {rawText ? (
              <pre className="max-h-96 overflow-auto rounded-md border border-line bg-bg p-3 font-sans text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink">
                {highlightSegments(rawText, quotes).map(function (seg, i) {
                  return seg.hit ? <mark key={i} className="rounded-sm bg-crust px-0.5 text-ink">{seg.text}</mark> : <span key={i}>{seg.text}</span>;
                })}
              </pre>
            ) : (
              <Skeleton className="h-24 w-full" />
            )}
            {quotes.length > 0 && <p className="mt-2 text-xs text-muted">Highlighted: the exact words each event came from. Every quote is checked against your text.</p>}
          </Card>
          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-bold text-ink">What students see</h3>
            {cards.length === 0 ? (
              <Card className="p-4 text-sm text-muted">
                {done.result.listings > 0 ? 'A sale listing. It went to the sales board.' : done.result.inReview > 0 ? `${done.result.inReview} held for a quick check before it goes live.` : 'Nothing new. These events are already listed, or there are none in it.'}
              </Card>
            ) : (
              <ul className="space-y-3">
                {cards.map(function (c) {
                  return (
                    <li key={c.id}>
                      {updatedIds.has(c.id) && (
                        <p className="mb-1 text-xs font-semibold text-update">
                          Updated {[...new Set(c.updatedFields.map(function (f) { return FIELD_LABEL[f] ?? f; }))].join(', ') || 'details'}. No duplicate made.
                        </p>
                      )}
                      <Card interactive className={ARRIVE_CLASS}><EventCard event={c} onOpen={onOpen} showDay /></Card>
                    </li>
                  );
                })}
              </ul>
            )}
            {cards.length > 0 && done.result.inReview > 0 && <p className="mt-2 text-xs text-muted">{done.result.inReview} more held for a quick check.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

function KindIcon({ kind }: { kind: string }) {
  const Icon = kind === 'upload' ? FileImage : kind === 'form' ? FileText : Mail;
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-md border-2 border-ink bg-crust-soft text-ink">
      <Icon size={18} aria-hidden />
    </span>
  );
}

function Outcome({ row }: { row: LogRow }) {
  const pills: { text: string; cls: string }[] = [];
  const live = row.created.filter(function (e) { return e.status !== 'review'; }).length;
  const review = row.created.length - live;
  if (live) pills.push({ text: `${live} new ${live === 1 ? 'event' : 'events'}`, cls: 'bg-accent-soft text-accent' });
  if (row.updated.length) {
    const what = [...new Set(row.updated.flatMap(function (u) { return u.changedFields.map(function (f) { return FIELD_LABEL[f] ?? f; }); }))];
    pills.push({ text: what.length ? `Updated ${what.join(', ')}` : 'Updated', cls: 'bg-update-soft text-update' });
  }
  if (review) pills.push({ text: `${review} held for a check`, cls: 'bg-sauce-soft text-sauce' });
  if (row.listings) pills.push({ text: row.listings === 1 ? '1 listing' : `${row.listings} listings`, cls: 'bg-crust-soft text-crust-ink' });
  if (row.status === 'failed') pills.push({ text: 'Failed', cls: 'bg-cancel-soft text-cancel' });
  if (!pills.length) pills.push({ text: 'No events', cls: 'bg-sunken text-muted' });
  return (
    <span className="flex flex-wrap gap-1.5">
      {pills.map(function (p) { return <span key={p.text} className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold', p.cls)}>{p.text}</span>; })}
    </span>
  );
}

function RecentList({ log }: { log: LogRow[] | undefined }) {
  const [open, setOpen] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(function () {
    if (!log) return;
    const ids = log.map(function (r) { return r.id; });
    const prev = seen.current;
    seen.current = new Set(ids);
    if (!prev) return;
    const added = ids.filter(function (id) { return !prev.has(id); });
    if (!added.length) return;
    setFresh(new Set(added));
    const t = setTimeout(function () { setFresh(new Set()); }, 1800);
    return function () { clearTimeout(t); };
  }, [log]);

  if (!log) return <div className="space-y-3">{[0, 1, 2].map(function (i) { return <Skeleton key={i} className="h-20 w-full rounded-lg" />; })}</div>;
  if (log.length === 0) return <Card className="p-4 text-sm text-muted">No mail yet.</Card>;
  return (
    <ul className="space-y-3">
      {log.map(function (row) {
        const isOpen = open === row.id;
        const quotes = row.created.flatMap(function (e) { return e.evidence; });
        return (
          <li key={row.id}>
            <Card className={cn('overflow-hidden', fresh.has(row.id) && ARRIVE_CLASS)}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={function () { setOpen(isOpen ? null : row.id); }}
                data-spot=""
                className="flex w-full items-start gap-3 rounded-[inherit] p-4 text-left"
              >
                <KindIcon kind={row.kind} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{row.subject ?? '(no subject)'}</span>
                  <span className="mt-0.5 block truncate text-sm text-muted">{[row.from, ago(row.receivedAt)].filter(Boolean).join(' · ')}</span>
                  <span className="mt-2 block"><Outcome row={row} /></span>
                </span>
              </button>
              {isOpen && (
                <div className="grid grid-cols-1 gap-4 border-t-2 border-ink bg-bg p-4 md:grid-cols-2">
                  <div className="min-w-0">
                    <h3 className="mb-2 text-sm font-bold text-ink">The email</h3>
                    <pre className="max-h-80 overflow-auto rounded-md border border-line bg-surface p-3 font-sans text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink">
                      {highlightSegments(row.rawText, quotes).map(function (s, i) {
                        return s.hit ? <mark key={i} className="rounded-sm bg-crust px-0.5 text-ink">{s.text}</mark> : <span key={i}>{s.text}</span>;
                      })}
                    </pre>
                  </div>
                  <div className="min-w-0">
                    <h3 className="mb-2 text-sm font-bold text-ink">What came out</h3>
                    {row.created.length === 0 && row.updated.length === 0 ? (
                      <p className="text-sm text-muted">{row.error ?? (row.listings ? 'A sale listing, not an event.' : 'No events. Newsletters often have none.')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {row.created.map(function (e) {
                          const pct = Math.round(e.confidence * 100);
                          return (
                            <li key={e.id} className="rounded-md border border-line bg-surface p-3 text-sm">
                              <p className="font-semibold text-ink">{e.title}</p>
                              <p className="tnum mt-0.5 text-muted">{formatWhen(e.start)}</p>
                              <div className="mt-2 flex items-center gap-2">
                                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
                                  <span className={cn('block h-full rounded-full', e.confidence >= 0.7 ? 'bg-food' : 'bg-sauce')} style={{ width: `${pct}%` }} />
                                </span>
                                <span className="tnum text-xs font-semibold text-muted">{pct}% sure</span>
                              </div>
                              <p className="mt-1.5 text-xs text-muted">{e.readBy === 'rules' ? 'Read by the backup rules' : 'Read by Claude'} · {e.evidence.length} {e.evidence.length === 1 ? 'quote' : 'quotes'} checked</p>
                            </li>
                          );
                        })}
                        {row.updated.map(function (u) {
                          return (
                            <li key={u.id} className="rounded-md border border-line bg-surface p-3 text-sm">
                              <span className="font-semibold text-ink">{u.title}</span>
                              <span className="mt-1 block text-update">Changed {[...new Set(u.changedFields.map(function (f) { return FIELD_LABEL[f] ?? f; }))].join(', ')}. No duplicate made.</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

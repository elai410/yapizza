'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { IngestResult } from '@/lib/contracts';
import { Button, Card, Input, Skeleton, buttonClasses, cn } from '@/components/ui';
import { EventCard } from '@/components/feed/EventCard';
import { EventSheet } from '@/components/event/EventSheet';

const ACCEPT = 'image/png,image/jpeg,application/pdf,text/csv,.csv,text/calendar,.ics';

type Phase =
  | { kind: 'idle' }
  | { kind: 'processing'; startedAt: number }
  | { kind: 'done'; result: IngestResult }
  | { kind: 'error'; status: number | null };

function count(n: number, one: string, many: string) {
  return n + ' ' + (n === 1 ? one : many);
}

function summary(r: IngestResult) {
  const parts = [count(r.created.length, 'event', 'events') + ' added in ' + (r.ms / 1000).toFixed(1) + 's'];
  if (r.updated.length > 0) parts.push(r.updated.length + ' updated');
  if (r.inReview > 0) parts.push(r.inReview + (r.inReview === 1 ? ' needs' : ' need') + ' review');
  if (r.listings > 0) parts.push(count(r.listings, 'listing', 'listings'));
  return parts.join(' · ');
}

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [hostName, setHostName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [elapsed, setElapsed] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const preview = useMemo(function () {
    return file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
  }, [file]);
  useEffect(function () {
    return function () { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  useEffect(function () {
    if (phase.kind !== 'processing') return;
    const startedAt = phase.startedAt;
    const t = setInterval(function () { setElapsed(Math.floor((Date.now() - startedAt) / 1000)); }, 250);
    return function () { clearInterval(t); };
  }, [phase]);

  function choose(f: File | null | undefined) {
    if (!f) return;
    setFile(f);
    setPhase({ kind: 'idle' });
  }

  function reset() {
    setFile(null);
    setHostName('');
    setPhase({ kind: 'idle' });
    setOpenId(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file || phase.kind === 'processing') return;
    const body = new FormData();
    body.append('file', file);
    if (hostName.trim()) body.append('hostName', hostName.trim());
    setElapsed(0);
    setPhase({ kind: 'processing', startedAt: Date.now() });
    try {
      const res = await fetch('/api/upload', { method: 'POST', body });
      if (!res.ok) { setPhase({ kind: 'error', status: res.status }); return; }
      setPhase({ kind: 'done', result: (await res.json()) as IngestResult });
    } catch {
      setPhase({ kind: 'error', status: null });
    }
  }

  const processing = phase.kind === 'processing';

  if (phase.kind === 'done') {
    const r = phase.result;
    const cards = r.created.concat(r.updated);
    return (
      <div data-testid="upload-result" className="mt-6 space-y-4">
        {cards.length === 0 && r.listings === 0 ? (
          <p className="text-sm text-ink">No events found in this file.</p>
        ) : (
          <p className="tnum text-sm text-ink">Added to Yapizza. {summary(r)}</p>
        )}
        {cards.length > 0 && (
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line">
              {cards.map(function (ev) {
                return <li key={ev.id}><EventCard event={ev} onOpen={setOpenId} /></li>;
              })}
            </ul>
          </Card>
        )}
        <div className="flex gap-2">
          <Link href="/" className={buttonClasses({ variant: 'secondary' })}>View feed</Link>
          <Button variant="ghost" onClick={reset}>Upload another</Button>
        </div>
        <EventSheet id={openId} onClose={function () { setOpenId(null); }} />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label
        onDragOver={function (e) { e.preventDefault(); setDragging(true); }}
        onDragLeave={function () { setDragging(false); }}
        onDrop={function (e) { e.preventDefault(); setDragging(false); choose(e.dataTransfer.files[0]); }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-10 text-center transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent',
          dragging && 'border-accent bg-accent-soft',
          processing && 'pointer-events-none opacity-60',
        )}
      >
        <input
          type="file"
          name="file"
          accept={ACCEPT}
          data-testid="upload-input"
          className="sr-only"
          disabled={processing}
          onChange={function (e) { choose(e.target.files?.[0]); }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
        {preview && <img src={preview} alt="" className="max-h-40 rounded-md border border-line object-contain" />}
        {file ? (
          <span className="text-sm font-medium text-ink">{file.name}</span>
        ) : (
          <span className="text-sm text-muted">Drop a file here or click to choose one.</span>
        )}
      </label>

      <div className="space-y-1.5">
        <label htmlFor="upload-host" className="block text-sm font-medium text-ink">Host name</label>
        <Input
          id="upload-host"
          value={hostName}
          placeholder="e.g. AACC"
          disabled={processing}
          onChange={function (e) { setHostName(e.target.value); }}
        />
      </div>

      <Button type="submit" variant="primary" data-testid="upload-submit" disabled={!file || processing}>
        Upload flyer
      </Button>

      {processing && (
        <div role="status" className="space-y-2">
          <p className="tnum text-sm text-muted">Reading the flyer · {elapsed}s</p>
          <Skeleton className="h-12 w-full" />
        </div>
      )}

      {phase.kind === 'error' && (
        <p className="text-sm text-ink">
          This file could not be read.{' '}
          <span className="tnum text-muted">{phase.status === null ? 'Network error' : 'HTTP ' + phase.status}</span>
        </p>
      )}
    </form>
  );
}

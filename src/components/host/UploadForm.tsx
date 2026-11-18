'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { IngestResult } from '@/lib/contracts';
import { Button, Card, Input, Skeleton, buttonClasses, cn } from '@/components/ui';
import { EventCard } from '@/components/feed/EventCard';
import { EventSheet } from '@/components/event/EventSheet';

const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf,text/csv,.csv,text/calendar,.ics';

type Phase =
  | { kind: 'processing' }
  | { kind: 'done'; result: IngestResult }
  | { kind: 'error'; status: number | null };

type Job = { id: number; file: File; preview: string | null; startedAt: number; phase: Phase };

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

let nextId = 0;

export function UploadForm() {
  const [staged, setStaged] = useState<File[]>([]);
  const [hostName, setHostName] = useState('');
  const [dragging, setDragging] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [now, setNow] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const previews = useRef<string[]>([]);

  useEffect(function () {
    const urls = previews.current;
    return function () { urls.forEach(function (u) { URL.revokeObjectURL(u); }); };
  }, []);

  const busy = jobs.some(function (j) { return j.phase.kind === 'processing'; });
  useEffect(function () {
    if (!busy) return;
    const t = setInterval(function () { setNow(Date.now()); }, 250);
    return function () { clearInterval(t); };
  }, [busy]);

  // Every file starts reading at once; each row resolves on its own.
  function upload(files: File[]) {
    const host = hostName.trim();
    const startedAt = Date.now();
    const started: Job[] = files.map(function (file) {
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
      if (preview) previews.current.push(preview);
      return { id: nextId++, file, preview, startedAt, phase: { kind: 'processing' } };
    });
    setNow(startedAt);
    setJobs(function (prev) { return prev.concat(started); });
    started.forEach(async function (job) {
      const body = new FormData();
      body.append('file', job.file);
      if (host) body.append('hostName', host);
      let phase: Phase;
      try {
        const res = await fetch('/api/upload', { method: 'POST', body });
        phase = res.ok ? { kind: 'done', result: (await res.json()) as IngestResult } : { kind: 'error', status: res.status };
      } catch {
        phase = { kind: 'error', status: null };
      }
      setJobs(function (prev) { return prev.map(function (j) { return j.id === job.id ? { ...j, phase } : j; }); });
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (staged.length === 0) return;
    upload(staged);
    setStaged([]);
  }

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="upload-host" className="block text-sm font-medium text-ink">Host name</label>
          <Input
            id="upload-host"
            value={hostName}
            placeholder="e.g. AACC"
            onChange={function (e) { setHostName(e.target.value); }}
          />
        </div>

        <label
          onDragOver={function (e) { e.preventDefault(); setDragging(true); }}
          onDragLeave={function () { setDragging(false); }}
          onDrop={function (e) {
            e.preventDefault();
            setDragging(false);
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) upload(files);
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-line-strong bg-surface px-4 py-10 text-center transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent',
            dragging && 'border-accent bg-accent-soft',
          )}
        >
          <input
            type="file"
            name="file"
            multiple
            accept={ACCEPT}
            data-testid="upload-input"
            className="sr-only"
            onChange={function (e) {
              setStaged(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
          {staged.length > 0 ? (
            <span className="text-sm font-medium text-ink">
              {staged.length === 1 ? staged[0].name : count(staged.length, 'file', 'files')}
            </span>
          ) : (
            <span className="text-sm text-muted">Drop flyers here or click to choose.</span>
          )}
        </label>

        {staged.length > 0 && (
          <Button type="submit" variant="primary" data-testid="upload-submit">
            Upload flyer
          </Button>
        )}
      </form>

      {jobs.length > 0 && (
        <div data-testid="upload-result" className="space-y-4">
          <ul className="space-y-4">
            {jobs.map(function (job) {
              return (
                <li key={job.id} className="flex gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                  {job.preview && <img src={job.preview} alt="" className="h-28 w-22 shrink-0 rounded-md border border-line object-cover" />}
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="truncate text-sm font-medium text-ink">{job.file.name}</p>
                    {job.phase.kind === 'processing' && (
                      <div role="status" className="space-y-2">
                        <p className="tnum text-sm text-muted">
                          Reading the flyer · {Math.max(0, Math.floor((now - job.startedAt) / 1000))}s
                        </p>
                        <Skeleton className="h-12 w-full" />
                      </div>
                    )}
                    {job.phase.kind === 'error' && (
                      <p className="text-sm text-ink">
                        This file could not be read.{' '}
                        <span className="tnum text-muted">{job.phase.status === null ? 'Network error' : 'HTTP ' + job.phase.status}</span>
                      </p>
                    )}
                    {job.phase.kind === 'done' && <Result result={job.phase.result} onOpen={setOpenId} />}
                  </div>
                </li>
              );
            })}
          </ul>
          {!busy && (
            <Link href="/" className={buttonClasses({ variant: 'secondary' })}>View feed</Link>
          )}
        </div>
      )}
      <EventSheet id={openId} onClose={function () { setOpenId(null); }} />
    </div>
  );
}

function Result({ result: r, onOpen }: { result: IngestResult; onOpen: (id: string) => void }) {
  const cards = r.created.concat(r.updated);
  if (cards.length === 0 && r.listings === 0) return <p className="text-sm text-ink">No new events in this file.</p>;
  return (
    <>
      <p className="tnum text-sm text-muted">{summary(r)}</p>
      {cards.length > 0 && (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {cards.map(function (ev) {
              return <li key={ev.id}><EventCard event={ev} onOpen={onOpen} /></li>;
            })}
          </ul>
        </Card>
      )}
    </>
  );
}

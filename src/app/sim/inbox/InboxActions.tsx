'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { IngestResult } from '@/lib/contracts';
import { Button, Input, Textarea } from '@/components/ui';

type Reply = { ok: boolean; detail: string; result?: IngestResult };

function summary(r: Reply) {
  if (!r.ok || !r.result) return r.detail;
  const x = r.result;
  return `${x.created.length} created · ${x.updated.length} updated · ${x.inReview} in review · ${x.ms} ms`;
}

function useSend() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<string | null>(null);
  async function send(body: unknown) {
    setBusy(true);
    try {
      const res = await fetch('/api/demo/send-email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const r = (await res.json().catch(() => ({ ok: false, detail: `HTTP ${res.status}` }))) as Reply;
      setOut(summary(r));
      router.refresh();
      return r.ok;
    } catch (err) {
      setOut(err instanceof Error ? err.message : 'Send failed');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, out, send };
}

export function SendFixture({ file }: { file: string }) {
  const { busy, out, send } = useSend();
  return (
    <span className="flex items-center gap-3">
      {out && <span className="text-xs text-muted tabular-nums">{out}</span>}
      <Button size="sm" disabled={busy} onClick={() => send({ fixture: file })}>
        {busy ? 'Sending' : 'Send'}
      </Button>
    </span>
  );
}

export function PasteForm() {
  const { busy, out, send } = useSend();
  const [subject, setSubject] = useState('');
  const [text, setText] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (await send({ email: { subject, text } })) {
      setSubject('');
      setText('');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Input aria-label="Subject" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      <Textarea aria-label="Body" placeholder="Email text" value={text} onChange={(e) => setText(e.target.value)} required rows={6} />
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Sending' : 'Send'}
        </Button>
        {out && <span className="text-sm text-muted tabular-nums">{out}</span>}
      </div>
    </form>
  );
}

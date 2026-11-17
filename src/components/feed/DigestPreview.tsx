'use client';

import useSWR from 'swr';
import type { DigestPreviewResponse } from '@/lib/contracts';
import { Card, EmptyState, Skeleton } from '@/components/ui';

async function fetcher(url: string): Promise<DigestPreviewResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`digest ${res.status}`);
  return res.json();
}

export function DigestPreview() {
  const { data, error, isLoading } = useSWR('/api/digest/preview', fetcher, { shouldRetryOnError: false });

  if (isLoading) return <Skeleton className="mt-6 h-[70vh] w-full" />;
  if (error || !data) return <EmptyState>The digest preview is not ready yet.</EmptyState>;

  return (
    <Card className="mt-6">
      <div className="flex items-baseline gap-3 border-b border-line px-4 py-3">
        <span className="text-xs text-muted">Subject</span>
        <span className="font-medium text-ink">{data.subject}</span>
      </div>
      {/* Empty sandbox: the email HTML renders but cannot run scripts or navigate. */}
      <iframe sandbox="" srcDoc={data.html} title="Digest preview" className="h-[70vh] w-full rounded-b-lg bg-surface" />
    </Card>
  );
}

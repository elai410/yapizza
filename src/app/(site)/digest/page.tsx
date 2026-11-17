import { notFound } from 'next/navigation';
import { isOn } from '@/lib/contracts';
import { DigestPreview } from '@/components/feed/DigestPreview';

export default function DigestPage() {
  if (!isOn('DIGEST')) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-xl font-semibold text-ink">Sunday digest</h1>
      <p className="mt-1 text-sm text-muted">What lands in your inbox each Sunday.</p>
      <DigestPreview />
    </div>
  );
}

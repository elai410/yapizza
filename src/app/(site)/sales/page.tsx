import { notFound } from 'next/navigation';
import { isOn } from '@/lib/contracts';
import { SalesBoard } from '@/components/feed/SalesBoard';

export default function SalesPage() {
  if (!isOn('SALES')) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-xl font-semibold text-ink">Sales board</h1>
      <p className="mt-1 text-sm text-muted">Things students and clubs are selling or giving away.</p>
      <SalesBoard />
    </div>
  );
}

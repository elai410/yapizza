import { notFound } from 'next/navigation';
import { isOn } from '@/lib/contracts';
import { TraditionsList } from '@/components/feed/TraditionsList';

export default function TraditionsPage() {
  if (!isOn('TRADITIONS')) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-xl font-semibold text-ink">Traditions</h1>
      <p className="mt-1 text-sm text-muted">Yale events that come back every year.</p>
      <TraditionsList />
    </div>
  );
}

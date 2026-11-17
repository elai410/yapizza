import { notFound } from 'next/navigation';
import { isOn } from '@/lib/contracts';
import { HostDashboard } from '@/components/host';

export default function HostPage() {
  if (!isOn('HOST')) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-xl font-semibold text-ink">Hosts</h1>
      <HostDashboard />
    </div>
  );
}

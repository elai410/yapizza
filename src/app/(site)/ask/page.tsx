import { notFound } from 'next/navigation';
import { isOn } from '@/lib/contracts';
import { AskPanel } from '@/components/ask';

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  if (!isOn('ASK')) notFound();
  const { q } = await searchParams;
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-4 text-xl font-semibold text-ink">Ask</h1>
      <AskPanel initialQuery={typeof q === 'string' ? q : undefined} />
    </div>
  );
}

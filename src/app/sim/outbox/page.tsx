import Link from 'next/link';
import { prisma } from '@/lib/db';
import { AutoRefresh } from './AutoRefresh';

export const dynamic = 'force-dynamic';

const tz = 'America/New_York';
const time = (d: Date) =>
  `${d.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })}`;

export default async function SimOutboxPage() {
  const sent = await prisma.notification.findMany({ orderBy: { sentAt: 'desc' }, take: 100 });
  return (
    <div className="space-y-8">
      <AutoRefresh />
      <h1 className="text-xl font-semibold text-ink">Simulated outbox</h1>
      {sent.length === 0 ? (
        <p className="text-sm text-faint">No messages sent yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {sent.map((n) => (
            <li key={n.id} className="space-y-1 px-3 py-2">
              <div className="grid gap-x-4 sm:grid-cols-[10rem_7rem_14rem_1fr]">
                <span className="text-faint tabular-nums">{time(n.sentAt)}</span>
                <span className="text-muted">
                  {n.channel} · {n.mode}
                </span>
                <span className="truncate text-muted">{n.to}</span>
                <span className="truncate text-ink">{n.subject}</span>
              </div>
              <details>
                <summary className="cursor-pointer text-xs text-muted">Body</summary>
                <pre className="mt-1 whitespace-pre-wrap font-sans text-xs text-ink">{n.body}</pre>
              </details>
              {n.eventId && (
                <Link href={`/?event=${n.eventId}`} className="text-xs text-accent underline-offset-2 hover:underline">
                  Open event
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

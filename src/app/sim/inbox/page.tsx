import { fixtureEmails, simInbox } from '@/lib/adapters/sim/mail';
import { PasteForm, SendFixture } from './InboxActions';

export const dynamic = 'force-dynamic';

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

export default async function SimInboxPage() {
  const received = simInbox();
  const fixtures = await fixtureEmails();
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-ink">Simulated inbox</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Paste email</h2>
        <PasteForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Received</h2>
        {received.length === 0 ? (
          <p className="text-sm text-faint">Nothing received yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
            {received.map(({ email, at }) => (
              <li key={email.messageId + at} className="grid gap-x-4 px-3 py-2 sm:grid-cols-[9rem_14rem_1fr]">
                <span className="text-faint tabular-nums">{time(at)}</span>
                <span className="truncate text-muted">{email.from}</span>
                <span className="truncate text-ink">{email.subject}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Fixtures</h2>
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
          {fixtures.map(({ file, email }) => (
            <li key={file} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
              <span className="w-48 truncate text-muted">{email.from}</span>
              <span className="min-w-0 flex-1 truncate text-ink" title={file}>
                {email.subject}
                {email.attachments?.length ? <span className="ml-2 text-faint">attachment</span> : null}
              </span>
              <SendFixture file={file} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

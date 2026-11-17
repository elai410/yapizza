import type { MailSource, RawEmail } from '@/lib/contracts';

// globalThis so the queue survives Next dev hot reloads.
const g = globalThis as unknown as { ypSimInbox?: RawEmail[] };
const queue = (g.ypSimInbox ??= []);

// CP2: seed the queue from fixtures/emails on first pull.
export const simMail: MailSource = {
  mode: 'sim',
  async pull() {
    return queue.splice(0, queue.length);
  },
  async inject(email) {
    queue.push(email);
  },
};

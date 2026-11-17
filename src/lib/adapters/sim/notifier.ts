import type { Notifier } from '@/lib/contracts';
import { prisma } from '@/lib/db';

export const simNotifier: Notifier = {
  mode: 'sim',
  async send({ to, subject, text, eventId }) {
    await prisma.notification.create({
      data: { channel: 'email', mode: 'sim', to, subject, body: text, eventId: eventId ?? null },
    });
    console.info(`[notify:sim] to=${to} subject="${subject}"`);
  },
};

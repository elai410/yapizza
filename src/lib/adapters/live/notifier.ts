import { Resend } from 'resend';
import type { Notifier } from '@/lib/contracts';
import { prisma } from '@/lib/db';
import { simNotifier } from '../sim/notifier';

export const liveNotifier: Notifier = {
  mode: 'live',
  async send(msg) {
    const { to, subject, text, eventId } = msg;
    try {
      const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.ALERT_FROM_EMAIL ?? '',
        to,
        subject,
        text,
      });
      if (error) throw new Error(error.message);
    } catch (err) {
      console.error(`[notify:live] send failed, falling back to sim: ${err instanceof Error ? err.message : String(err)}`);
      return simNotifier.send(msg);
    }
    await prisma.notification.create({
      data: { channel: 'email', mode: 'live', to, subject, body: text, eventId: eventId ?? null },
    });
    console.info(`[notify:live] to=${to} subject="${subject}"`);
  },
};

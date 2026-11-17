import { formatInTimeZone } from 'date-fns-tz';
import type { EventCard } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { prisma } from '.';

const TZ = 'America/New_York';
const WINDOW_MS = 12 * 36e5;

/** Is a free food card worth an alert right now: live, and starting within 12 hours or under way. */
export function alertable(c: EventCard, now = Date.now()): boolean {
  if (!c.freeFood || c.status !== 'live') return false;
  const start = Date.parse(c.start);
  const end = c.end ? Date.parse(c.end) : start + 36e5;
  return start <= now + WINDOW_MS && end > now;
}

/** Sends one free food alert per subscriber per event; returns how many went out. */
export async function notifyFreeFood(cards: EventCard[]): Promise<number> {
  const due = cards.filter((c) => alertable(c));
  if (!due.length) return 0;
  const users = await prisma.user.findMany({
    where: { alertFreeFood: true, alertEmail: { not: null } },
    select: { alertEmail: true },
  });
  const targets = [...new Set(users.map((u) => u.alertEmail!))];
  if (!targets.length) return 0;

  const notifier = adapters.notifier();
  let sent = 0;
  for (const c of due) {
    // The notifier writes a Notification row per send (sim does; live must too), which is the dedupe record.
    const already = await prisma.notification.findMany({
      where: { eventId: c.id, to: { in: targets } },
      select: { to: true },
    });
    const done = new Set(already.map((n) => n.to));
    const when = formatInTimeZone(new Date(c.start), TZ, 'EEE, MMM d · h:mm a');
    const text = [c.placeName ? `${when} at ${c.placeName}` : when, c.food].filter(Boolean).join('\n');
    for (const to of targets) {
      if (done.has(to)) continue;
      await notifier.send({ to, subject: `Free food: ${c.title}`, text, eventId: c.id });
      sent++;
    }
  }
  return sent;
}

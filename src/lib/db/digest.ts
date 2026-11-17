import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { DigestPreviewResponse, EventCard } from '@/lib/contracts';
import { DEMO_STUDENTS } from '@/lib/adapters/demo-students';
import { writeDigest } from '@/lib/pipeline/digest';
import { listEvents, prisma } from '.';

const TZ = 'America/New_York';
const MAX = 8; // pre-ranked top 8, so writeDigest's start-ordered fallback still leads with the reader's college and free food

/** Now through the coming Sunday 23:59 in New York; at least the next 7 days so a Saturday digest is not empty. */
export function digestWindow(now = new Date()): { from: Date; to: Date } {
  const dow = Number(formatInTimeZone(now, TZ, 'i')); // 1 Mon .. 7 Sun
  const sunday = new Date(now.getTime() + (7 - dow) * 864e5);
  const sundayEnd = fromZonedTime(`${formatInTimeZone(sunday, TZ, 'yyyy-MM-dd')}T23:59:59`, TZ);
  const week = new Date(now.getTime() + 7 * 864e5);
  return { from: now, to: sundayEnd > week ? sundayEnd : week };
}

async function reader(userId?: string): Promise<{ name: string; college: string | null } | null> {
  if (!userId) return null;
  const demo = DEMO_STUDENTS.find((s) => s.id === userId);
  if (demo) return demo;
  return prisma.user.findUnique({ where: { id: userId }, select: { name: true, college: true } });
}

export async function buildDigest(userId?: string, now = new Date()): Promise<DigestPreviewResponse> {
  const { from, to } = digestWindow(now);
  const r = await reader(userId);
  const college = r?.college ?? null;
  const all = (await listEvents({ from: from.toISOString(), to: to.toISOString() })).filter((e) => e.status === 'live');
  // Own college first, then free food, then by start (listEvents is already sorted by start; sort is stable).
  const rank = (e: EventCard) => (college && e.college === college ? 0 : 2) + (e.freeFood ? 0 : 1);
  const events = all.sort((a, b) => rank(a) - rank(b)).slice(0, MAX).sort((a, b) => a.start.localeCompare(b.start));

  const d = await writeDigest(events, { userName: r?.name, college, now });
  return { subject: d.subject, html: d.html, eventIds: d.eventIds };
}

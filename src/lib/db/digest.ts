import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import type { DigestPreviewResponse, EventCard } from '@/lib/contracts';
import { DEMO_STUDENTS } from '@/lib/adapters/demo-students';
import { listEvents, prisma } from '.';

const TZ = 'America/New_York';
const MAX = 12;

/** Now through the coming Sunday 23:59 in New York; at least the next 7 days so a Saturday digest is not empty. */
export function digestWindow(now = new Date()): { from: Date; to: Date } {
  const dow = Number(formatInTimeZone(now, TZ, 'i')); // 1 Mon .. 7 Sun
  const sunday = new Date(now.getTime() + (7 - dow) * 864e5);
  const sundayEnd = fromZonedTime(`${formatInTimeZone(sunday, TZ, 'yyyy-MM-dd')}T23:59:59`, TZ);
  const week = new Date(now.getTime() + 7 * 864e5);
  return { from: now, to: sundayEnd > week ? sundayEnd : week };
}

async function userCollege(userId?: string): Promise<string | null> {
  if (!userId) return null;
  const demo = DEMO_STUDENTS.find((s) => s.id === userId);
  if (demo) return demo.college;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { college: true } });
  return u?.college ?? null;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function row(e: EventCard): string {
  const when = e.allDay
    ? formatInTimeZone(new Date(e.start), TZ, 'EEE, MMM d')
    : formatInTimeZone(new Date(e.start), TZ, 'EEE, MMM d · h:mm a');
  const meta = [e.placeName, e.hostName].filter(Boolean).join(' · ');
  return `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb">
<div style="font-size:13px;color:#4b5563;font-variant-numeric:tabular-nums">${esc(when)}${
    e.freeFood ? ' <span style="color:#00356B;font-weight:600">Free food</span>' : ''
  }</div>
<div style="font-size:16px;font-weight:600;color:#111827;margin-top:2px">${esc(e.title)}</div>
${meta ? `<div style="font-size:14px;color:#4b5563;margin-top:2px">${esc(meta)}</div>` : ''}
</td></tr>`;
}

export async function buildDigest(userId?: string, now = new Date()): Promise<DigestPreviewResponse> {
  const { from, to } = digestWindow(now);
  const college = await userCollege(userId);
  const all = (await listEvents({ from: from.toISOString(), to: to.toISOString() })).filter((e) => e.status === 'live');
  // Own college first, then free food, then by start (listEvents is already sorted by start; sort is stable).
  const rank = (e: EventCard) => (college && e.college === college ? 0 : 2) + (e.freeFood ? 0 : 1);
  const events = all.sort((a, b) => rank(a) - rank(b)).slice(0, MAX).sort((a, b) => a.start.localeCompare(b.start));

  const subject = `This week at Yale: ${events.length} events`;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff">
<div style="max-width:560px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111827">
<div style="font-size:20px;font-weight:700;color:#00356B">Yapizza</div>
<div style="font-size:14px;color:#4b5563;margin-top:4px">${esc(subject)}</div>
<table role="presentation" style="width:100%;border-collapse:collapse;margin-top:16px">${
    events.length ? events.map(row).join('') : '<tr><td style="padding:12px 0;color:#4b5563">No events this week.</td></tr>'
  }</table>
</div></body></html>`;
  return { subject, html, eventIds: events.map((e) => e.id) };
}

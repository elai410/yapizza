import { NextResponse } from 'next/server';
import { formatInTimeZone } from 'date-fns-tz';
import { isOn, type RawEmail } from '@/lib/contracts';
import { adapters } from '@/lib/adapters';
import { fixtureEmails, resetSimMail } from '@/lib/adapters/sim/mail';
import { resetSimCalendar } from '@/lib/adapters/sim/calendar';
import { ingestEmail } from '@/lib/pipeline/ingest';
import { notifyFreeFood } from '@/lib/db/alerts';
import { listEvents } from '@/lib/db';
import { resetDemoData } from '@/lib/db/seed';
import type { EventCard } from '@/lib/contracts';

const TZ = 'America/New_York';

class BadRequest extends Error {}

function fromFixture(file: unknown): RawEmail {
  const hit = fixtureEmails().find((f) => f.file === file);
  if (!hit) throw new BadRequest(`unknown fixture: ${String(file)}`);
  // Fresh messageId so a repeat send creates a new Source; dedup decides same or update.
  const id = hit.email.messageId.replace(/^<|>$/g, '');
  // Keep the fixture's sentAt: relative dates ("monday") resolve against when the club sent it.
  return { ...hit.email, messageId: `${id}.${Date.now()}` };
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

// Pasted text or a full RawEmail; subject and text are required, the rest falls back to defaults.
function fromPaste(p: Record<string, unknown>): RawEmail {
  if (typeof p.subject !== 'string' || typeof p.text !== 'string' || !p.text.trim()) {
    throw new BadRequest('email needs subject and text');
  }
  const to = Array.isArray(p.to) && p.to.every((x) => typeof x === 'string') ? (p.to as string[]) : ['yapizza@intake.test'];
  return {
    messageId: str(p.messageId) ?? `paste-${crypto.randomUUID()}`,
    from: str(p.from) ?? 'Pasted <paste@yapizza.test>',
    to,
    subject: p.subject,
    text: p.text,
    html: str(p.html),
    listName: str(p.listName),
    sentAt: str(p.sentAt) ?? new Date().toISOString(),
    attachments: Array.isArray(p.attachments) ? (p.attachments as RawEmail['attachments']) : undefined,
  };
}

// Silliman GA in the Buttery: a real host and venue with nothing seeded today, so dedup creates a new card.
function freeFoodNow(): RawEmail {
  const now = new Date();
  const until = new Date(now.getTime() + 45 * 60_000);
  const t = (d: Date) => formatInTimeZone(d, TZ, 'h:mm a');
  return {
    messageId: `silliman-ga-buttery-pizza.${now.getTime()}`,
    from: 'Silliman GA <silliman-ga@lists.yale.test>',
    to: ['yapizza@intake.test'],
    subject: 'Free pizza in the Buttery right now',
    text: [
      'Hi Silliman!',
      '',
      `Free pizza in the Silliman Buttery, ${formatInTimeZone(now, TZ, 'EEEE M/d')}, ${t(now)} to ${t(until)}. Open to all Yalies, first come first served.`,
      '',
      'Love,',
      'Silliman GA',
    ].join('\n'),
    listName: 'Silliman GA',
    sentAt: now.toISOString(),
  };
}

async function send(label: string, email: RawEmail, alsoAlert: () => Promise<EventCard[]> = async () => []) {
  await adapters.mail().inject(email);
  const result = await ingestEmail(email, 'demo');
  // Safe to repeat: notifyFreeFood skips subscribers already alerted for an event.
  const alerts = isOn('ALERTS') ? await notifyFreeFood([...result.created, ...result.updated, ...(await alsoAlert())]) : 0;
  const detail = `${label}: ${result.created.length} created, ${result.updated.length} updated, ${result.inReview} in review${alerts ? `, ${alerts} alerts` : ''}`;
  return NextResponse.json({ ok: true, detail, result });
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const b: unknown = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  if (!isOn('DEMO_PANEL')) return new NextResponse('Not found', { status: 404 });
  const { action } = await params;
  try {
    switch (action) {
      case 'send-email': {
        const b = await body(req);
        if (b.email && typeof b.email === 'object') {
          const email = fromPaste(b.email as Record<string, unknown>);
          return await send(email.subject, email);
        }
        return await send(String(b.fixture), fromFixture(b.fixture));
      }
      case 'room-change':
        return await send('room change', fromFixture('39-yums-panel-room-change.json'));
      case 'cancel':
        return await send('cancel', fromFixture('40-aacc-politics-purse-canceled.json'));
      case 'free-food-now':
        // A repeat press dedups to `same`; still alert anyone who subscribed since on today's Buttery card.
        return await send('free food now', freeFoodNow(), async () =>
          (await listEvents({ freeFood: true, from: new Date(Date.now() - 12 * 36e5).toISOString(), q: 'buttery' })).filter(
            (c) => c.hostName === 'Silliman GA',
          ),
        );
      case 'reset': {
        const seeded = await resetDemoData();
        resetSimMail();
        resetSimCalendar();
        return NextResponse.json({ ok: true, detail: 'demo data reseeded', result: seeded });
      }
      default:
        return new NextResponse('Not found', { status: 404 });
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    if (err instanceof BadRequest) return NextResponse.json({ ok: false, detail }, { status: 400 });
    console.error(`[demo] ${action} failed`, err);
    return NextResponse.json({ ok: false, detail }, { status: 500 });
  }
}

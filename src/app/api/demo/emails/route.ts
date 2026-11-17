import { NextResponse } from 'next/server';
import { isOn } from '@/lib/contracts';
import { fixtureEmails } from '@/lib/adapters/sim/mail';

export function GET() {
  if (!isOn('DEMO_PANEL')) return new NextResponse('Not found', { status: 404 });
  const emails = fixtureEmails().map(({ file, email }) => ({
    file,
    subject: email.subject,
    from: email.from,
    listName: email.listName ?? null,
    sentAt: email.sentAt,
    hasAttachment: (email.attachments?.length ?? 0) > 0,
  }));
  return NextResponse.json({ emails });
}

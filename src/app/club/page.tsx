import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { isOn, type RawEmail } from '@/lib/contracts';
import { ClubConsole, type Sample } from './ClubConsole';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'For clubs · Yapizza' };

// Real club emails from fixtures/emails, offered as one-click samples. 34 then 39 shows a room change.
const SAMPLES: { file: string; label: string }[] = [
  { file: '34-yums-weekly-nov-16.json', label: 'YUMS weekly, 3 events' },
  { file: '39-yums-panel-room-change.json', label: 'YUMS room change' },
  { file: '01-silliman-ga-goat-yoga.json', label: 'Silliman GA' },
];

export default async function ClubPage() {
  if (!isOn('UPLOAD')) notFound();
  const samples = (
    await Promise.all(
      SAMPLES.map(async function ({ file, label }): Promise<Sample | null> {
        try {
          const e = JSON.parse(await readFile(path.join(process.cwd(), 'fixtures/emails', file), 'utf8')) as RawEmail;
          return { label, from: e.from, subject: e.subject, listName: e.listName ?? '', text: e.text, sentAt: e.sentAt };
        } catch {
          return null;
        }
      }),
    )
  ).filter(function (s): s is Sample { return s !== null; });
  return <ClubConsole samples={samples} sampleFlyer={isOn('DEMO_PANEL') ? '/demo/flyer/helix-langer-flyer.png' : null} />;
}

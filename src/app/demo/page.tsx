import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { isOn, type RawEmail } from '@/lib/contracts';
import { DemoPanel, type FixtureEmail } from './DemoPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Demo panel · Yapizza' };

async function listDir(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter(function (f) { return !f.startsWith('.'); }).sort();
  } catch {
    return [];
  }
}

export default async function DemoPage() {
  if (!isOn('DEMO_PANEL')) notFound();
  const emailDir = path.join(process.cwd(), 'fixtures/emails');
  const files = (await listDir(emailDir)).filter(function (f) { return f.endsWith('.json'); });
  const emails: FixtureEmail[] = await Promise.all(
    files.map(async function (file) {
      try {
        const raw = JSON.parse(await readFile(path.join(emailDir, file), 'utf8')) as RawEmail;
        return { file, subject: raw.subject, from: raw.from };
      } catch {
        return { file, subject: '(unreadable)', from: '' };
      }
    }),
  );
  const flyers = await listDir(path.join(process.cwd(), 'fixtures/flyers'));
  return <DemoPanel emails={emails} flyers={flyers} />;
}

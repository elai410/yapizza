// Run: pnpm tsx src/lib/pipeline/files.selfcheck.ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readFile } from './files';

const root = process.cwd();

// Builds a one-page PDF with a real text layer, computing xref offsets by hand.
function tinyPdf(line: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${line}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach(function (o, i) { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map(function (n) { return `${String(n).padStart(10, '0')} 00000 n \n`; }).join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

async function main() {
  // Image
  const png = readFileSync(path.join(root, 'fixtures/flyers/helix-langer-flyer.png'));
  const img = await readFile({ filename: 'helix-langer-flyer.png', mimeType: 'image/png', data: png }, 'Helix');
  assert.equal(img.kind, 'input');
  if (img.kind !== 'input') throw new Error('unreachable');
  assert.equal(img.input.images?.length, 1);
  assert.equal(img.input.images?.[0].mimeType, 'image/png');
  assert.equal(img.input.listName, 'Helix');
  await assert.rejects(readFile({ filename: 'big.png', mimeType: 'image/png', data: Buffer.alloc(20 * 1024 * 1024 + 1) }), /20 MiB/);

  // ICS: one timed (EST), one all-day; detected by extension with a generic mime type
  const ics = readFileSync(path.join(root, 'src/lib/pipeline/__fixtures__/sample.ics'));
  const cal = await readFile({ filename: 'sample.ics', mimeType: 'application/octet-stream', data: ics });
  assert.equal(cal.kind, 'events');
  if (cal.kind !== 'events') throw new Error('unreachable');
  assert.equal(cal.events.length, 2);
  const timed = cal.events.find(function (e) { return !e.allDay; })!;
  const allDay = cal.events.find(function (e) { return e.allDay; })!;
  assert.equal(timed.title, 'AACC Study Break');
  assert.equal(timed.start, '2026-12-04T18:00:00-05:00');
  assert.equal(timed.end, '2026-12-04T19:30:00-05:00');
  assert.equal(timed.locationRaw, 'AACC');
  assert.equal(timed.hostName, 'Asian American Cultural Center');
  assert.equal(timed.freeFood, true);
  assert.equal(timed.rsvpUrl, 'https://example.edu/rsvp');
  assert.match(timed.evidence[0], /^DTSTART;TZID=America\/New_York:20261204T180000/);
  assert.equal(allDay.title, 'Last day of classes');
  assert.equal(allDay.start, '2026-11-10T00:00:00-05:00');
  assert.equal(allDay.freeFood, false);

  // CSV
  const csv = Buffer.from('title,date,place\nFall Tea,Nov 20,JE Common Room\nDumpling Night,Dec 1,AACC\n');
  const sheet = await readFile({ filename: 'events.csv', mimeType: 'text/csv', data: csv });
  assert.equal(sheet.kind, 'input');
  if (sheet.kind !== 'input') throw new Error('unreachable');
  assert.ok(sheet.input.text.includes('title: Fall Tea; date: Nov 20; place: JE Common Room'));
  assert.ok(sheet.input.text.includes('title: Dumpling Night; date: Dec 1; place: AACC'));

  // PDF with a text layer
  const pdf = await readFile({ filename: 'flyer.pdf', mimeType: 'application/pdf', data: tinyPdf('Dumpling Night Thursday Dec 3 at 7 PM in the AACC lounge') });
  assert.equal(pdf.kind, 'input');
  if (pdf.kind !== 'input') throw new Error('unreachable');
  assert.ok(pdf.input.text.includes('Dumpling Night'), pdf.input.text);
  await assert.rejects(readFile({ filename: 'scan.pdf', mimeType: 'application/pdf', data: tinyPdf('x') }), /no text layer/);

  // Plain text and unsupported
  const txt = await readFile({ filename: 'note.txt', mimeType: 'text/plain', data: Buffer.from('Tea at 4') });
  assert.equal(txt.kind === 'input' && txt.input.text, 'Tea at 4');
  await assert.rejects(readFile({ filename: 'a.zip', mimeType: 'application/zip', data: Buffer.alloc(1) }), /unsupported file type: application\/zip/);

  console.log('files selfcheck: ok');
}

main().catch(function (err) { console.error(err); process.exit(1); });

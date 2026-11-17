import { notFound } from 'next/navigation';
import { isOn } from '@/lib/contracts';
import { UploadForm } from '@/components/host';

export default function UploadPage() {
  if (!isOn('UPLOAD')) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-xl font-semibold text-ink">Upload flyer</h1>
      <p className="mt-1 text-sm text-muted">Images, PDFs, CSV, or .ics.</p>
      <UploadForm />
    </div>
  );
}

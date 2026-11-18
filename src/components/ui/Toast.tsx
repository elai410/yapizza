'use client';

import { Toaster as SonnerToaster } from 'sonner';

export { toast } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-start gap-2 rounded-md border-2 border-ink bg-surface px-4 py-3 text-sm text-ink shadow-pop',
          title: 'font-medium',
          description: 'text-muted',
          actionButton: 'ml-auto shrink-0 text-sm font-medium text-accent',
          cancelButton: 'shrink-0 text-sm text-muted',
        },
      }}
    />
  );
}

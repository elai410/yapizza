'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from './cn';

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

export interface SheetContentProps extends Omit<ComponentPropsWithoutRef<typeof Dialog.Content>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export function SheetContent({ title, description, children, className, ...props }: SheetContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out" />
      <Dialog.Content
        {...(description ? {} : { 'aria-describedby': undefined })}
        {...props}
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-lg bg-surface p-5 shadow-sheet',
          'data-[state=open]:animate-sheet-up data-[state=closed]:animate-sheet-down md:data-[state=open]:animate-panel-in md:data-[state=closed]:animate-panel-out',
          'md:inset-x-auto md:top-0 md:right-0 md:bottom-auto md:h-dvh md:max-h-none md:w-[440px] md:rounded-none md:border-l md:border-line',
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Dialog.Title className="text-lg font-semibold text-ink">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mt-1 text-sm text-muted">{description}</Dialog.Description>
            ) : null}
          </div>
          <Dialog.Close
            aria-label="Close"
            className="-mt-1 -mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <X size={18} aria-hidden />
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

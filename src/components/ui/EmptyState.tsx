import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';
import { Slice } from '@/components/brand/Slice';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  action?: ReactNode;
}

export function EmptyState({ children, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center text-[15px] text-muted', className)} {...props}>
      <Slice className="mb-4 size-14 -rotate-12" />
      <p className="max-w-xs">{children}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

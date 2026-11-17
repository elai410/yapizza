import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  action?: ReactNode;
}

export function EmptyState({ children, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn('px-6 py-16 text-center text-[15px] text-muted', className)} {...props}>
      <p>{children}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

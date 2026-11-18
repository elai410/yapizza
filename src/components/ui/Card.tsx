import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { interactive = false, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      data-spot={interactive ? '' : undefined}
      className={cn(
        'rounded-lg border-2 border-ink bg-surface shadow-pop',
        interactive && 'lift cursor-pointer',
        className,
      )}
      {...props}
    />
  );
});

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
      className={cn(
        'rounded-lg border border-line bg-surface shadow-card',
        interactive && 'cursor-pointer transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-raised',
        className,
      )}
      {...props}
    />
  );
});

import { cn } from './cn';
import { Card } from './Card';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-md bg-sunken bg-[linear-gradient(90deg,var(--color-sunken)_0%,var(--color-line)_50%,var(--color-sunken)_100%)] bg-[length:200%_100%]',
        className,
      )}
    />
  );
}

export function EventCardSkeleton({ className }: { className?: string }) {
  return (
    <Card aria-hidden className={cn('space-y-2.5 p-4', className)}>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="h-4.5 w-3/4" />
      <Skeleton className="h-3.5 w-1/2" />
    </Card>
  );
}

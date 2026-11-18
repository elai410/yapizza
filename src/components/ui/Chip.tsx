import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: ReactNode;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { selected = false, icon, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        'press inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-3.5 text-[13px] font-semibold',
        selected
          ? 'border-ink bg-ink text-bg shadow-pop-sm'
          : 'border-line-strong bg-surface text-ink hover:-translate-y-px hover:border-ink',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});

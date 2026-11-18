import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-2 border-ink bg-accent text-accent-ink shadow-pop-sm hover:-translate-y-px hover:bg-accent-hover hover:shadow-pop active:shadow-none',
  secondary: 'border-2 border-ink bg-surface text-ink shadow-pop-sm hover:-translate-y-px hover:bg-crust-soft hover:shadow-pop active:shadow-none',
  ghost: 'text-muted hover:text-ink hover:bg-sunken',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-sm font-semibold',
  sm: 'h-8 px-3 text-[13px] font-semibold',
};

export function buttonClasses({
  variant = 'secondary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    'press inline-flex items-center justify-center gap-1.5 rounded-full whitespace-nowrap disabled:pointer-events-none disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, className, type = 'button', ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} {...props} />;
});

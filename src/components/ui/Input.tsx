import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const FIELD =
  'w-full rounded-md border border-line-strong bg-surface px-3 text-[15px] text-ink placeholder:text-faint transition-colors focus:border-accent';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leading, className, ...props },
  ref,
) {
  const input = <input ref={ref} className={cn(FIELD, 'h-10', leading ? 'pl-9' : null, className)} {...props} />;
  if (!leading) return input;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-faint">{leading}</span>
      {input}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(FIELD, 'min-h-24 py-2', className)} {...props} />;
  },
);

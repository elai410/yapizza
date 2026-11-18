import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const FIELD =
  'w-full rounded-md border-2 border-ink bg-surface px-3.5 text-[15px] text-ink shadow-pop-sm placeholder:text-faint transition-shadow focus:shadow-pop focus-visible:outline-2 focus-visible:outline-offset-2';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { leading, className, ...props },
  ref,
) {
  const input = <input ref={ref} className={cn(FIELD, 'h-11', leading ? 'pl-10' : null, className)} {...props} />;
  if (!leading) return input;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted">{leading}</span>
      {input}
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(FIELD, 'min-h-24 py-2', className)} {...props} />;
  },
);

import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from './cn';

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Same rule as the pipeline's evidence check: ignore case and whitespace differences.
export function evidencePattern(quotes: string[]): RegExp | null {
  const parts = quotes
    .map(function (q) { return q.trim(); })
    .filter(Boolean)
    .sort(function (a, b) { return b.length - a.length; })
    .map(function (q) { return q.split(/\s+/).map(escape).join('\\s+'); });
  return parts.length ? new RegExp(`(${parts.join('|')})`, 'gi') : null;
}

// Source text with Grok's evidence quotes marked. Keeps the email's line breaks.
export function Highlighted({ text, quotes, className }: { text: string; quotes: string[]; className?: string }) {
  const re = evidencePattern(quotes);
  const pieces = re ? text.split(re) : [text];
  return (
    <div className={cn('whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted', className)}>
      {pieces.map(function (p, i) {
        // split() with one capture group puts matches at odd indexes.
        return i % 2 === 1
          ? <mark key={i} className="rounded-[3px] bg-accent-soft px-0.5 text-ink shadow-[inset_0_-1.5px_0_var(--color-accent)]">{p}</mark>
          : p;
      })}
    </div>
  );
}

// The one place Grok is named in the student UI (Ask box and the source drawer).
export function GrokNote({ className }: { className?: string }) {
  return <p className={cn('text-xs text-faint', className)}>Read by Grok</p>;
}

// Collapsible section, native <details> so it works without JS and with the keyboard.
export function Disclosure({ summary, children, defaultOpen, className }: { summary: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string }) {
  return (
    <details open={defaultOpen} className={cn('group border-t border-line', className)}>
      <summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-ink select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight size={16} aria-hidden className="text-muted transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}

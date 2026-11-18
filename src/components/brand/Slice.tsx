import type { SVGProps } from 'react';

// A New Haven slice: charred crust, mozz, tomato and pepperoni. Decorative unless given a title.
export function Slice({ title, ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} {...props}>
      {title ? <title>{title}</title> : null}
      <path d="M8 13 C22 5 42 5 56 13 L33.5 59 a2 2 0 0 1 -3 0 Z" fill="var(--color-crust)" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M8 13 C22 5 42 5 56 13 L53.6 18 C40.5 11.2 23.5 11.2 10.4 18 Z" fill="#c98a3a" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="16.5" cy="13.2" r="1.2" fill="var(--color-ink)" />
      <circle cx="44" cy="11.4" r="1" fill="var(--color-ink)" />
      <circle cx="25" cy="25" r="4.6" fill="var(--color-sauce)" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="39" cy="28" r="4" fill="var(--color-sauce)" stroke="var(--color-ink)" strokeWidth="2" />
      <circle cx="32" cy="42" r="3.6" fill="var(--color-sauce)" stroke="var(--color-ink)" strokeWidth="2" />
      <path d="M30 20.5 q2 1.5 4 0" stroke="var(--color-ink)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M22.5 35 q1.5 1.6 3.5 .4" stroke="var(--color-ink)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// The round pie mark: Yale Blue plate, cut in six.
export function PizzaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className}>
      <circle cx="16" cy="16" r="14.5" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="10.5" fill="var(--color-crust)" stroke="var(--color-ink)" strokeWidth="1.5" />
      <g stroke="var(--color-ink)" strokeWidth="1.3" strokeLinecap="round">
        <path d="M16 5.5v21" /><path d="M6.9 10.75l18.2 10.5" /><path d="M6.9 21.25l18.2-10.5" />
      </g>
      <circle cx="12.6" cy="12.2" r="1.7" fill="var(--color-sauce)" />
      <circle cx="20.2" cy="14.2" r="1.5" fill="var(--color-sauce)" />
      <circle cx="15" cy="20.6" r="1.6" fill="var(--color-sauce)" />
    </svg>
  );
}

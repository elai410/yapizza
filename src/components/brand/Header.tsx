'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { isOn, type Flag } from '@/lib/contracts';
import { useIntro } from '@/components/intro/IntroProvider';
import { cn } from '@/components/ui/cn';
import { PizzaMark } from './Slice';

const NAV: { href: string; label: string; flag: Flag }[] = [
  { href: '/', label: 'Events', flag: 'FEED' },
  { href: '/ask', label: 'Ask', flag: 'ASK' },
  { href: '/traditions', label: 'Traditions', flag: 'TRADITIONS' },
  { href: '/sales', label: 'Sales', flag: 'SALES' },
  { href: '/club', label: 'For clubs', flag: 'UPLOAD' },
];

const WORDMARK = 'font-display text-[22px] font-extrabold tracking-[-0.03em] text-white';

export function Header() {
  const { playing } = useIntro();
  const path = usePathname();
  const items = NAV.filter(function (n) { return isOn(n.flag); });

  return (
    <header className="sticky top-0 z-30 h-[var(--header-h)] bg-accent [&_:focus-visible]:outline-white">
      <div className="mx-auto flex h-[60px] max-w-5xl items-center gap-3 px-4 sm:gap-8 sm:px-6">
        <Link href="/" aria-label="Yapizza home" className="group -mx-1 flex shrink-0 items-center gap-2 rounded-md px-1">
          <PizzaMark className="size-7 transition-transform duration-500 ease-out group-hover:rotate-[60deg]" />
          {playing ? (
            <span className={cn(WORDMARK, 'invisible')}>Yapizza</span>
          ) : (
            <motion.span layoutId="wordmark" className={cn(WORDMARK, 'inline-block')}>Yapizza</motion.span>
          )}
        </Link>
        <nav aria-label="Main" className="no-scrollbar -mr-4 flex min-w-0 items-center gap-1 overflow-x-auto pr-4 sm:mr-0 sm:pr-0">
          {items.map(function (n) {
            const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'press inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-sm font-medium',
                  active ? 'border-2 border-ink bg-crust text-ink shadow-pop-sm' : 'text-white/80 hover:bg-white/10 hover:text-white',
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto hidden shrink-0 text-xs font-semibold tracking-wide text-white/75 lg:block">New Haven, CT</span>
      </div>
      <div aria-hidden className="checker h-2 border-y-2 border-ink" />
    </header>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { isOn, type Flag } from '@/lib/contracts';
import { useIntro } from '@/components/intro/IntroProvider';
import { cn } from '@/components/ui/cn';

const NAV: { href: string; label: string; flag: Flag }[] = [
  { href: '/', label: 'Events', flag: 'FEED' },
  { href: '/ask', label: 'Ask', flag: 'ASK' },
  { href: '/traditions', label: 'Traditions', flag: 'TRADITIONS' },
  { href: '/sales', label: 'Sales', flag: 'SALES' },
  { href: '/host', label: 'Hosts', flag: 'HOST' },
];

const WORDMARK = 'text-[19px] font-semibold tracking-[-0.02em] text-ink';

export function Header() {
  const { playing } = useIntro();
  const path = usePathname();
  const items = NAV.filter(function (n) { return isOn(n.flag); });

  return (
    <header className="sticky top-0 z-30 h-[var(--header-h)] border-b border-line bg-bg">
      <div className="mx-auto flex h-full max-w-5xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
        <Link href="/" aria-label="Yapizza home" className="-mx-1 rounded-sm px-1">
          {playing ? (
            <span className={cn(WORDMARK, 'invisible')}>Yapizza</span>
          ) : (
            <motion.span layoutId="wordmark" className={cn(WORDMARK, 'inline-block')}>Yapizza</motion.span>
          )}
        </Link>
        <nav aria-label="Main" className="no-scrollbar -mr-4 flex min-w-0 items-center gap-0.5 overflow-x-auto pr-4 sm:mr-0 sm:gap-1 sm:pr-0">
          {items.map(function (n) {
            const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-sm transition-colors sm:px-2.5',
                  active ? 'font-medium text-ink' : 'text-muted hover:bg-sunken hover:text-ink',
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

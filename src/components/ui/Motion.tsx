'use client';

import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1] as const;

// Card enter: 6px rise and fade. `index` staggers the first screen (capped so long lists don't lag).
export function Enter({ children, index = 0, className }: { children: ReactNode; index?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout={reduce ? false : 'position'}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: reduce ? 0.2 : 0.18, delay: Math.min(index, 8) * 0.025, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Wrap a list of <Enter key=...> items so filter changes crossfade and removed items exit.
export function EnterList({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={true} mode="popLayout">{children}</AnimatePresence>;
}

// Add to a Card that just arrived from live intake.
export const ARRIVE_CLASS = 'animate-arrive';

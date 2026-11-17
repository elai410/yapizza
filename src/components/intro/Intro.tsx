'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { isOn } from '@/lib/contracts';
import { useIntro } from './IntroProvider';
import { SUBJECTS } from './subjects';

const KEY = 'yapizza:intro-seen';
const EASE = [0.22, 1, 0.36, 1] as const;
const LINES = 28;
const WEDGES = 6;
const CIRCLE = 160;
const FINISH_MS = 2300;
const SAFETY_MS = 2600;

// Timeline (seconds): lines stream 0-0.9, collapse 0.9-1.4; circle grows 0.95-1.4,
// splits 1.4-1.55, wedges fly out 1.55-1.9; wordmark in 1.5-1.9; backdrop fades 1.9-2.25.
const T = { collapse: 0.9, gather: 1.4, circleIn: 0.95, split: 1.55, fly: 1.9, word: 1.5, fade: 1.9 };

type Phase = 'pending' | 'play' | 'reduced' | 'done';

// Deterministic pseudo-random in [0, 1) so positions are stable across renders.
function rand(i: number, salt: number): number {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

// Static 60 degree sector, clockwise from 12 o'clock. Points sit outside the circle;
// rounded-full trims the outer edge to the arc.
function sector(i: number): string {
  const pt = function (deg: number) {
    const r = (deg * Math.PI) / 180;
    return `${50 + 75 * Math.sin(r)}% ${50 - 75 * Math.cos(r)}%`;
  };
  return `polygon(50% 50%, ${pt(i * 60)}, ${pt(i * 60 + 30)}, ${pt(i * 60 + 60)})`;
}

export function Intro() {
  const { finish } = useIntro();
  const [phase, setPhase] = useState<Phase>('pending');
  const [view, setView] = useState({ w: 0, h: 0 });
  const done = useRef(false);
  // Decided once per mount so StrictMode's double effect doesn't read our own write.
  const played = useRef<boolean | null>(null);

  const end = useRef(function () {});
  end.current = function () {
    if (done.current) return;
    done.current = true;
    setPhase('done');
    finish();
  };

  useEffect(function () {
    if (played.current === null) {
      played.current = false;
      try {
        played.current = window.sessionStorage.getItem(KEY) === '1';
        window.sessionStorage.setItem(KEY, '1');
      } catch {
        // storage blocked: play once for this page load
      }
    }
    if (played.current || !isOn('INTRO')) {
      end.current();
      return;
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setView({ w: window.innerWidth, h: window.innerHeight });
    setPhase(reduced ? 'reduced' : 'play');

    const skip = function () { end.current(); };
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    const t1 = window.setTimeout(skip, reduced ? 200 : FINISH_MS);
    const t2 = window.setTimeout(skip, SAFETY_MS);
    return function () {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (phase === 'pending' || phase === 'done') return null;

  if (phase === 'reduced') {
    return (
      <motion.div
        aria-hidden
        data-testid="intro"
        className="fixed inset-0 z-50 flex items-center justify-center bg-bg"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'linear' }}
      >
        <span className="text-5xl font-semibold tracking-tight text-ink">Yapizza</span>
      </motion.div>
    );
  }

  const cx = view.w / 2;
  const cy = view.h / 2;
  const spread = Math.min((view.w * 0.8) / WEDGES, 140);

  return (
    <div aria-hidden data-testid="intro" className="fixed inset-0 z-50 overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-bg"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: T.fade, duration: 0.35, ease: EASE }}
      />

      {Array.from({ length: LINES }, function (_, i) {
        const left = rand(i, 1) * view.w * 0.78;
        const top = (0.03 + rand(i, 2) * 0.92) * view.h;
        const delay = i * 0.024;
        const dur = T.gather - delay;
        return (
          <motion.span
            key={i}
            className="absolute whitespace-nowrap text-[13px] text-muted"
            style={{ left, top, transformOrigin: '0 50%', willChange: 'transform, opacity' }}
            initial={{ opacity: 0, x: 48, y: 0, scale: 1 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: [48, 0, 0, cx - left - 30],
              y: [0, 0, 0, cy - top],
              scale: [1, 1, 1, 0.2],
            }}
            transition={{ delay, duration: dur, times: [0, 0.22 / dur, (T.collapse - delay) / dur, 1], ease: EASE }}
          >
            {SUBJECTS[i % SUBJECTS.length]}
          </motion.span>
        );
      })}

      {Array.from({ length: WEDGES }, function (_, i) {
        const mid = ((i * 60 + 30) * Math.PI) / 180;
        const sx = 16 * Math.sin(mid);
        const sy = -16 * Math.cos(mid);
        const dur = T.fly - T.circleIn;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full bg-accent"
            style={{
              width: CIRCLE,
              height: CIRCLE,
              left: cx - CIRCLE / 2,
              top: cy - CIRCLE / 2,
              clipPath: sector(i),
              willChange: 'transform, opacity',
            }}
            initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
            animate={{
              scale: [0, 1, 1, 0.4],
              x: [0, 0, sx, (i - (WEDGES - 1) / 2) * spread],
              y: [0, 0, sy, view.h * 0.35],
              opacity: [1, 1, 1, 0],
            }}
            transition={{
              delay: T.circleIn,
              duration: dur,
              times: [0, (T.gather - T.circleIn) / dur, (T.split - T.circleIn) / dur, 1],
              ease: EASE,
            }}
          />
        );
      })}

      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: T.word, duration: 0.4, ease: EASE }}
          className="text-5xl"
        >
          <motion.span layoutId="wordmark" className="font-semibold tracking-tight text-ink">
            Yapizza
          </motion.span>
        </motion.div>
      </div>
    </div>
  );
}

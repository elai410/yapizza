'use client';

import { useEffect } from 'react';

// One listener for the whole app: the [data-spot] element under the cursor gets --mx/--my for its light.
export function PointerFx() {
  useEffect(function () {
    if (!window.matchMedia('(hover: hover)').matches) return;
    let frame = 0;
    function onMove(e: PointerEvent) {
      const el = (e.target as Element | null)?.closest?.('[data-spot]') as HTMLElement | null;
      if (!el || frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    return function () { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(frame); };
  }, []);
  return null;
}

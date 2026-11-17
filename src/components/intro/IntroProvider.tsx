'use client';

import { LayoutGroup } from 'motion/react';
import { createContext, useContext, useState, type ReactNode } from 'react';

type IntroState = { playing: boolean; finish: () => void };

const IntroContext = createContext<IntroState>({ playing: false, finish: function () {} });

// Starts "playing" so the header wordmark stays hidden on first paint; Intro decides on mount
// (sessionStorage, flag) whether to actually play or call finish() at once.
export function IntroProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(true);
  return (
    <IntroContext.Provider value={{ playing, finish: function () { setPlaying(false); } }}>
      <LayoutGroup>{children}</LayoutGroup>
    </IntroContext.Provider>
  );
}

export function useIntro(): IntroState {
  return useContext(IntroContext);
}

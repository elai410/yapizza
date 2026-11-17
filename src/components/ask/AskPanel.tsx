'use client';

import { useState } from 'react';
import { EventSheet } from '@/components/event/EventSheet';
import { AskBox } from './AskBox';

export function AskPanel({ initialQuery }: { initialQuery?: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <>
      <AskBox onOpen={setOpenId} autoFocus initialQuery={initialQuery} />
      <EventSheet id={openId} onClose={function () { setOpenId(null); }} />
    </>
  );
}

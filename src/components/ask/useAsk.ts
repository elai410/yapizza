'use client';

import { useCallback, useRef, useState } from 'react';
import { TAGS, type AskResponse, type EventCard } from '@/lib/contracts';
import { COLLEGES, rangeFor } from '@/lib/client';
import { TAG_LABELS } from '@/components/ui';

async function askApi(q: string): Promise<AskResponse> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ q }),
  });
  if (!res.ok) throw new Error('ask ' + res.status);
  return res.json();
}

const STOP = new Set(['a', 'an', 'the', 'any', 'anything', 'something', 'events', 'event', 'in', 'at', 'on', 'for', 'this', 'week', 'is', 'there', 'what', 'whats', "what's", 'me', 'show', 'find', 'near', 'with', 'and', 'or', 'of', 'to', 'tonight', 'today', 'talks', 'talk']);

// Turns a plain question into /api/events filters: "free food tonight" -> freeFood + today.
// shortcut: English keywords only; /api/ask with the model handles real questions.
export function fallbackParams(question: string): URLSearchParams {
  let text = ' ' + question.toLowerCase() + ' ';
  const p = new URLSearchParams(rangeFor(/\b(tonight|today)\b/.test(text) ? 'today' : 'week'));
  if (/free\s*food|\bfood\b|\bpizza\b|\bdinner\b|\blunch\b/.test(text)) { p.set('freeFood', 'true'); text = text.replace(/free\s*food|\b(food|pizza|dinner|lunch)\b/g, ' '); }
  const tags = TAGS.filter(function (t) {
    const label = TAG_LABELS[t].toLowerCase();
    return t !== 'free_food' && (text.includes(' ' + label) || text.includes(' ' + t));
  });
  if (tags.length) { p.set('tags', tags.join(',')); tags.forEach(function (t) { text = text.replace(TAG_LABELS[t].toLowerCase(), ' ').replace(t, ' '); }); }
  const college = COLLEGES.find(function (c) { return text.includes(c.toLowerCase()); });
  if (college) { p.set('college', college); text = text.replace(college.toLowerCase(), ' '); }
  const words = text.split(/[^a-z0-9']+/).filter(function (w) { return w.length > 2 && !STOP.has(w); });
  // The api matches q as one substring, so send the most specific word.
  if (words.length) p.set('q', words.sort(function (x, y) { return y.length - x.length; })[0]);
  return p;
}

// Keyword search, used when /api/ask is missing or fails.
async function searchEvents(q: string): Promise<AskResponse> {
  const params = fallbackParams(q);
  const res = await fetch('/api/events?' + params.toString());
  if (!res.ok) throw new Error('events ' + res.status);
  const { events } = (await res.json()) as { events: EventCard[] };
  return {
    answer: '',
    results: events.slice(0, 8).map(function (e) { return { event: e, why: '' }; }),
    mode: 'fallback',
  };
}

export function useAsk() {
  const [data, setData] = useState<AskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const seq = useRef(0);

  const ask = useCallback(async function (query: string) {
    const id = ++seq.current;
    setQ(query);
    setLoading(true);
    setError(false);
    let result: AskResponse | null = null;
    try {
      result = await askApi(query);
    } catch {
      try {
        result = await searchEvents(query);
      } catch {
        result = null;
      }
    }
    if (id !== seq.current) return; // a newer ask started
    setData(result);
    setError(result === null);
    setLoading(false);
  }, []);

  return { ask, data, loading, error, q };
}

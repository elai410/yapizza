import type { EventStatus, ExtractedEvent, ReadBy } from '@/lib/contracts';

// One message or file to read. RawEmail maps onto this; uploads fill text and/or images.
export interface ExtractInput {
  text: string;
  subject?: string | null;
  from?: string | null;
  listName?: string | null;
  sentAt?: string | null;          // ISO; anchors "this Friday"
  images?: { mimeType: string; dataBase64: string }[];
}

export type CheckedEvent = ExtractedEvent & { status: EventStatus };

export interface CheckedExtraction {
  events: CheckedEvent[];
  flagged: boolean;
  flagReason: string | null;
  mode: 'grok' | 'replay' | 'fallback';
  ms: number;
  readBy: ReadBy;                  // contracts v1.1; saveExtraction stores it
  stages?: { extracted: number; checked: number };
  readText?: string;               // text the extraction read, incl. a known flyer's transcription
}

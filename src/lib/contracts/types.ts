export const TAGS = ['free_food', 'cultural', 'professional', 'academic', 'social', 'arts', 'athletics', 'traditions'] as const;
export type Tag = (typeof TAGS)[number];
export type Audience = 'open_to_all' | 'members_only' | 'college_only';
export type EventStatus = 'live' | 'review' | 'canceled';
export type IntegrationMode = 'live' | 'sim';
export type GrokMode = 'live' | 'record' | 'replay';

export interface EventCard {
  id: string;
  title: string;
  start: string;              // ISO with offset, America/New_York
  end: string | null;
  allDay: boolean;
  placeId: string | null;
  placeName: string | null;   // Yale short name, e.g. "WLH 309"
  hostName: string | null;
  tags: Tag[];
  freeFood: boolean;
  food: string | null;
  audience: Audience;
  college: string | null;
  status: EventStatus;
  updatedFields: string[];    // non-empty after a room or time change
  createdAt: string;
}

export interface EventDetail extends EventCard {
  summary: string;
  locationRaw: string | null;
  rsvpUrl: string | null;
  confidence: number;
  evidence: string[];         // quotes found in the source
  gcalTemplateUrl: string;
  source: {
    id: string;
    kind: 'email' | 'forward' | 'upload' | 'form' | 'demo';
    subject: string | null;
    sender: string | null;
    listName: string | null;
    receivedAt: string;
    rawText: string;
  };
}

export interface RawEmail {
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  listName?: string;
  sentAt: string;
  attachments?: { filename: string; mimeType: string; dataBase64: string }[];
}

export interface ExtractedEvent {
  kind: 'event' | 'listing';
  title: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  locationRaw: string | null;
  placeId: string | null;
  hostName: string | null;
  summary: string;
  tags: Tag[];
  freeFood: boolean;
  food: string | null;
  audience: Audience;
  college: string | null;
  rsvpUrl: string | null;
  price: string | null;       // listings only
  evidence: string[];
  confidence: number;         // 0 to 1
}

export interface ExtractionResult {
  events: ExtractedEvent[];
  flagged: boolean;           // harassment or spam
  flagReason: string | null;
}

export interface MatchDecision {
  action: 'new' | 'same' | 'update' | 'cancel';
  matchId: string | null;
  changedFields: string[];
}

export interface IngestResult {
  sourceId: string;
  created: EventCard[];
  updated: EventCard[];
  listings: number;
  inReview: number;
  ms: number;
}

export interface AskResponse {
  answer: string;
  results: { event: EventCard; why: string }[];
  mode: 'grok' | 'fallback';
}

export interface IntegrationStatus {
  grok: GrokMode;
  gmail: IntegrationMode;
  gcal: IntegrationMode;
  notify: IntegrationMode;
  auth: IntegrationMode;
  forcedSim: boolean;
}

export interface SessionUser {
  id: string;
  netid: string;
  name: string;
  college: string | null;
}

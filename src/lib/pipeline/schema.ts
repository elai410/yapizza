import { z } from 'zod';
import { TAGS, type ExtractionResult } from '@/lib/contracts';

// Every field required (nullable where the contract allows null): strict json_schema demands it.
export const extractedEventSchema = z.object({
  kind: z.enum(['event', 'listing']),
  title: z.string(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  allDay: z.boolean(),
  locationRaw: z.string().nullable(),
  placeId: z.string().nullable(),
  hostName: z.string().nullable(),
  summary: z.string(),
  tags: z.array(z.enum(TAGS)),
  freeFood: z.boolean(),
  food: z.string().nullable(),
  audience: z.enum(['open_to_all', 'members_only', 'college_only']),
  college: z.string().nullable(),
  rsvpUrl: z.string().nullable(),
  price: z.string().nullable(),
  evidence: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const extractionSchema = z.object({
  events: z.array(extractedEventSchema),
  flagged: z.boolean(),
  flagReason: z.string().nullable(),
});

export type ExtractionSchema = z.infer<typeof extractionSchema>;

// Compile-time proof the schema output is an ExtractionResult.
const _assignable: (x: ExtractionSchema) => ExtractionResult = (x) => x;
void _assignable;

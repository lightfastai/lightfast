import { z } from "zod";

// The atom of Lightfast — every endpoint composes from this
export const EventBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  type: z.string(),
  url: z.string().nullable(),
  occurredAt: z.string().datetime().nullable(),
});
export type EventBase = z.infer<typeof EventBaseSchema>;

export const RerankModeSchema = z.enum(["fast", "balanced", "thorough"]);
export type RerankMode = z.infer<typeof RerankModeSchema>;

export const SearchFiltersSchema = z.object({
  sourceTypes: z.array(z.string()).optional(),
  observationTypes: z.array(z.string()).optional(),
  dateRange: z
    .object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    })
    .optional(),
  sources: z.array(z.string()).optional(),
  entityTypes: z.array(z.string()).optional(),
});
export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

export const SourceReferenceSchema = z.object({
  type: z.string(),
  id: z.string(),
  url: z.string().optional(),
  label: z.string().optional(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

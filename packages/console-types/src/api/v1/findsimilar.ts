/**
 * /v1/findsimilar API schemas
 *
 * Find content similar to a given document or observation.
 */

import { z } from "zod";
import { V1SearchFiltersSchema } from "./search";

/**
 * V1 FindSimilar request schema
 */
export const V1FindSimilarRequestSchema = z
  .object({
    /** Content ID to find similar items for */
    id: z.string().optional(),
    /** URL to find similar items for (alternative to id) */
    url: z.string().url().optional(),
    /** Maximum results to return (1-50, default 10) */
    limit: z.number().int().min(1).max(50).default(10),
    /** Minimum similarity threshold (0-1, default 0.5) */
    threshold: z.number().min(0).max(1).default(0.5),
    /** Only return results from same source type */
    sameSourceOnly: z.boolean().default(false),
    /** IDs to exclude from results */
    excludeIds: z.array(z.string()).optional(),
    /** Optional filters for scoping results */
    filters: V1SearchFiltersSchema.optional(),
  })
  .refine((data) => Boolean(data.id) || Boolean(data.url), {
    message: "Either id or url must be provided",
  });

export type V1FindSimilarRequest = z.infer<typeof V1FindSimilarRequestSchema>;

/**
 * Similar content result
 */
export const V1FindSimilarResultSchema = z.object({
  /** Content ID */
  id: z.string(),
  /** Content title */
  title: z.string(),
  /** URL to source */
  url: z.string(),
  /** Content snippet */
  snippet: z.string().optional(),
  /** Combined similarity score (0-1) */
  score: z.number(),
  /** Raw vector similarity score */
  vectorSimilarity: z.number(),
  /** Entity overlap ratio (0-1) */
  entityOverlap: z.number().optional(),
  /** Whether result is in same cluster as source */
  sameCluster: z.boolean(),
  /** Source system */
  source: z.string(),
  /** Content type */
  type: z.string(),
  /** When content occurred */
  occurredAt: z.string().datetime().optional(),
});

export type V1FindSimilarResult = z.infer<typeof V1FindSimilarResultSchema>;

/**
 * Source document info in response
 */
export const V1FindSimilarSourceSchema = z.object({
  /** Source content ID */
  id: z.string(),
  /** Source title */
  title: z.string(),
  /** Source content type */
  type: z.string(),
  /** Cluster info if available */
  cluster: z
    .object({
      /** Cluster topic */
      topic: z.string().nullable(),
      /** Number of items in cluster */
      memberCount: z.number(),
    })
    .optional(),
});

export type V1FindSimilarSource = z.infer<typeof V1FindSimilarSourceSchema>;

/**
 * V1 FindSimilar response schema
 */
export const V1FindSimilarResponseSchema = z.object({
  /** Source document/observation info */
  source: V1FindSimilarSourceSchema,
  /** Similar content items */
  similar: z.array(V1FindSimilarResultSchema),
  /** Response metadata */
  meta: z.object({
    /** Total similar items found (before limit) */
    total: z.number(),
    /** Request processing time in ms */
    took: z.number(),
    /** Embedding source info */
    inputEmbedding: z.object({
      /** Whether embedding was found in storage */
      found: z.boolean(),
      /** Whether embedding was generated on-the-fly */
      generated: z.boolean(),
    }),
  }),
  /** Request ID for debugging */
  requestId: z.string(),
});

export type V1FindSimilarResponse = z.infer<typeof V1FindSimilarResponseSchema>;

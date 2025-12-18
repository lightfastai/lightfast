/**
 * /v1/contents API schemas
 *
 * Fetch full content for documents and observations by ID.
 */

import { z } from "zod";

/**
 * V1 Contents request schema
 */
export const V1ContentsRequestSchema = z.object({
  /** Array of content IDs (doc_* or obs_*) */
  ids: z
    .array(z.string())
    .min(1, "At least one ID required")
    .max(50, "Maximum 50 IDs per request")
    .describe("Array of document or observation IDs to fetch (1-50 IDs)"),
});

export type V1ContentsRequest = z.infer<typeof V1ContentsRequestSchema>;

/**
 * Individual content item in response
 */
export const V1ContentItemSchema = z.object({
  /** Content ID (doc_* or obs_*) */
  id: z.string(),
  /** Content title */
  title: z.string().nullable(),
  /** URL to source (GitHub, Linear, Vercel, etc.) */
  url: z.string(),
  /** Content snippet or full content for observations */
  snippet: z.string(),
  /** Full content (observations only) */
  content: z.string().optional(),
  /** Source system (github, linear, vercel) */
  source: z.string(),
  /** Content type (pull_request, issue, file, deployment) */
  type: z.string(),
  /** When the content was created/occurred */
  occurredAt: z.string().datetime().optional(),
  /** Additional metadata */
  metadata: z.record(z.unknown()).optional(),
});

export type V1ContentItem = z.infer<typeof V1ContentItemSchema>;

/**
 * V1 Contents response schema
 */
export const V1ContentsResponseSchema = z.object({
  /** Found content items */
  items: z.array(V1ContentItemSchema),
  /** IDs that were not found */
  missing: z.array(z.string()),
  /** Request ID for debugging */
  requestId: z.string(),
});

export type V1ContentsResponse = z.infer<typeof V1ContentsResponseSchema>;

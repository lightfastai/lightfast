/**
 * /v1/contents API types and schemas
 *
 * @see docs/architecture/phase1/package-structure.md
 */

import { z } from "zod";
import { RequestIdSchema } from "./common";

/**
 * Contents request schema - batch fetch by IDs
 */
export const ContentsRequestSchema = z.object({
  /** Array of document IDs to fetch */
  ids: z.array(z.string()).min(1, "At least one ID required").max(50, "Maximum 50 IDs per request"),
});

export type ContentsRequest = z.infer<typeof ContentsRequestSchema>;

/**
 * Document content schema
 */
export const DocumentContentSchema = z.object({
  /** Document ID */
  id: z.string(),
  /** Repo-relative path */
  path: z.string(),
  /** Document title */
  title: z.string().nullable(),
  /** Document description */
  description: z.string().nullable(),
  /** Full document content */
  content: z.string(),
  /** Additional metadata */
  metadata: z.record(z.unknown()),
  /** When the document was committed (ISO 8601) */
  committedAt: z.string().datetime(),
});

export type DocumentContent = z.infer<typeof DocumentContentSchema>;

/**
 * Contents response schema
 */
export const ContentsResponseSchema = z.object({
  /** Array of document contents */
  documents: z.array(DocumentContentSchema),
  /** Request ID for debugging */
  requestId: RequestIdSchema,
});

export type ContentsResponse = z.infer<typeof ContentsResponseSchema>;

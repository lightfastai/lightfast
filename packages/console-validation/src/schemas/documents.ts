import { sourceTypeSchema } from "@repo/console-providers";
import { z } from "zod";

// ── Process Document Event ───────────────────────────────────────────────────

export const processDocumentEventSchema = z.object({
  /** Document content */
  content: z.string(),
  /** Content hash for idempotency */
  contentHash: z.string(),
  /** Deterministic document ID */
  documentId: z.string(),
  /** Additional metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Optional parent document ID */
  parentDocId: z.string().optional(),
  /** Relationships to extract */
  relationships: z.record(z.string(), z.unknown()).optional(),
  /** Source-specific identifier */
  sourceId: z.string(),
  /** Source-specific metadata */
  sourceMetadata: z.record(z.string(), z.unknown()),
  /** Source type (discriminated union) */
  sourceType: sourceTypeSchema,
  /** Document title */
  title: z.string(),
  /** Workspace DB UUID (also store ID, 1:1 relationship) */
  workspaceId: z.string(),
});

export type ProcessDocumentEvent = z.infer<typeof processDocumentEventSchema>;

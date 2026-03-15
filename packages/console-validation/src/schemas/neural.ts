import { z } from "zod";

// ── Significance Scoring ──────────────────────────────────────────────────────

export const significanceResultSchema = z.object({
  factors: z.array(z.string()),
  score: z.number(),
});

export type SignificanceResult = z.infer<typeof significanceResultSchema>;

// ── Entity Vector Metadata ────────────────────────────────────────────────────

/**
 * Pinecone vector metadata for entity narrative embeddings (layer="entities").
 *
 * occurredAt and createdAt are Unix timestamps in milliseconds — use numbers
 * for reliable Pinecone range filter operators ($gte / $lte). ISO strings sort
 * incorrectly for non-UTC timezone variants.
 */
export const entityVectorMetadataSchema = z
  .object({
    layer: z.literal("entities"),
    entityExternalId: z.string(),
    entityType: z.string(),
    provider: z.string(),
    /** Last known action derived from latest event's sourceType, e.g. "merged" */
    latestAction: z.string(), // "" when unknown — Pinecone disallows null
    title: z.string(),
    snippet: z.string(),
    /** Unix timestamp in milliseconds of latest event for this entity */
    occurredAt: z.number(),
    /** Unix timestamp in milliseconds of entity.extractedAt (first seen) */
    createdAt: z.number(),
    /** SHA-256 prefix of narrative text for content-dedup */
    narrativeHash: z.string(),
    /** Total number of events seen for this entity (entity.occurrenceCount) */
    totalEvents: z.number(),
    /** Max significance score (0-100) across all events for this entity */
    significanceScore: z.number(),
  })
  .catchall(
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
  );

export type EntityVectorMetadata = z.infer<typeof entityVectorMetadataSchema>;

// ── Neural Failure Output ─────────────────────────────────────────────────────

export const neuralFailureOutputSchema = z
  .object({
    error: z.string(),
    inngestFunctionId: z.string(),
    status: z.literal("failure"),
  })
  .catchall(z.unknown());

export type NeuralFailureOutput = z.infer<typeof neuralFailureOutputSchema>;

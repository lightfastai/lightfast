import { z } from "zod";

// ── Significance Scoring ──────────────────────────────────────────────────────

export const significanceResultSchema = z.object({
  factors: z.array(z.string()),
  score: z.number(),
});

export type SignificanceResult = z.infer<typeof significanceResultSchema>;

// ── Observation Vector Metadata ───────────────────────────────────────────────

export const observationVectorMetadataSchema = z
  .object({
    layer: z.string(),
    observationId: z.string(),
    observationType: z.string(),
    occurredAt: z.string(),
    snippet: z.string(),
    source: z.string(),
    sourceId: z.string(),
    sourceType: z.string(),
    title: z.string(),
    view: z.enum(["title", "content", "summary"]),
  })
  .catchall(
    z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
  );

export type ObservationVectorMetadata = z.infer<
  typeof observationVectorMetadataSchema
>;

// ── Multi-View Embedding Result ───────────────────────────────────────────────

const embeddingViewSchema = z.object({
  vectorId: z.string(),
  vector: z.array(z.number()),
});

export const multiViewEmbeddingResultSchema = z.object({
  content: embeddingViewSchema,
  legacyVectorId: z.string(),
  summary: embeddingViewSchema,
  title: embeddingViewSchema,
});

export type MultiViewEmbeddingResult = z.infer<
  typeof multiViewEmbeddingResultSchema
>;

// ── Neural Failure Output ─────────────────────────────────────────────────────

export const neuralFailureOutputSchema = z
  .object({
    error: z.string(),
    inngestFunctionId: z.string(),
    status: z.literal("failure"),
  })
  .catchall(z.unknown());

export type NeuralFailureOutput = z.infer<typeof neuralFailureOutputSchema>;

import { z } from "zod";

export const QueryTypeSchema = z.enum([
  "temporal",    // Time-based queries
  "actor",       // Person-based queries
  "technical",   // Technical topic queries
  "status",      // Status/state queries
  "multi-hop",   // Requires multiple retrieval steps
  "null",        // Should return nothing
]);

export const EvalCaseSchema = z.object({
  id: z.string(),                                    // Unique case ID
  query: z.string().min(5).max(500),                 // Search query
  queryType: QueryTypeSchema,
  expectedObservationIds: z.array(z.string()).min(0), // Ground truth
  gradedRelevance: z.record(z.number().min(0).max(3)).optional(), // observationId -> 0-3
  expectedAnswer: z.string().optional(),              // For answer quality eval
  requiredCitations: z.array(z.string()).optional(),  // Must-cite observations
  requiredEntities: z.array(z.string()).optional(),   // Must-mention entities
  complexity: z.enum(["simple", "medium", "complex"]),
  source: z.enum(["manual", "synthetic", "production"]),
  annotator: z.string().optional(),                   // "human" or "llm"
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const EvalDatasetSchema = z.object({
  version: z.string(),                                // Semver
  createdAt: z.string().datetime(),                   // ISO 8601
  description: z.string(),
  workspaceId: z.string(),                            // Eval workspace ID
  cases: z.array(EvalCaseSchema),
});

export type QueryType = z.infer<typeof QueryTypeSchema>;
export type EvalCase = z.infer<typeof EvalCaseSchema>;
export type EvalDataset = z.infer<typeof EvalDatasetSchema>;

/**
 * Validate and parse a dataset JSON file
 */
export function validateDataset(data: unknown): EvalDataset {
  return EvalDatasetSchema.parse(data);
}

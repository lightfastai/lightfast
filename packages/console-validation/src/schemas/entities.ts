import { z } from "zod";

/**
 * Entity Category Schema
 *
 * High-level classification of extracted entities from observations.
 * Used for semantic grouping and targeted search.
 */
export const entityCategorySchema = z.enum([
  "engineer",    // Team members, contributors (@mentions, emails)
  "project",     // Features, repos, tickets (#123, ENG-456)
  "endpoint",    // API routes (POST /api/users)
  "config",      // Environment variables (DATABASE_URL)
  "definition",  // File paths, technical terms
  "service",     // External services, dependencies
  "reference",   // Generic references (commits, branches)
]);

export type EntityCategory = z.infer<typeof entityCategorySchema>;

/**
 * All valid entity categories
 */
export const ENTITY_CATEGORIES = entityCategorySchema.options;

/**
 * Schema for LLM entity extraction response
 *
 * LLM extracts contextual entities that regex cannot catch:
 * - Service names mentioned in prose (e.g., "deployed to Vercel")
 * - Technical concepts and frameworks (e.g., "using React Query")
 * - Implicit engineer references (e.g., "John fixed the bug")
 * - Project/feature references without standard format
 *
 * Future enhancements could include:
 * - Entity relationships (e.g., "X depends on Y")
 * - Sentiment/status inference (e.g., "auth is broken")
 * - Temporal context (e.g., "last week's deployment")
 */
export const llmExtractedEntitySchema = z.object({
  category: entityCategorySchema.describe("Entity category"),
  key: z.string().max(500).describe("Canonical entity identifier"),
  value: z.string().optional().describe("Human-readable description"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Extraction confidence from 0.0 (uncertain) to 1.0 (certain)"),
  reasoning: z
    .string()
    .max(200)
    .optional()
    .describe("Brief explanation of why this entity was extracted"),
});

export const llmEntityExtractionResponseSchema = z.object({
  entities: z
    .array(llmExtractedEntitySchema)
    .max(15)
    .describe("Extracted entities from the observation content"),
});

export type LLMExtractedEntity = z.infer<typeof llmExtractedEntitySchema>;
export type LLMEntityExtractionResponse = z.infer<typeof llmEntityExtractionResponseSchema>;

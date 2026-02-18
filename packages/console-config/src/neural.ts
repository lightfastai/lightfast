/**
 * Neural Memory Configuration
 *
 * Configuration constants for neural memory system features.
 *
 * @packageDocumentation
 */

/**
 * LLM Entity Extraction Configuration
 *
 * Controls when and how LLM entity extraction runs as part of the
 * observation capture pipeline. LLM extraction complements rule-based
 * (regex) extraction by identifying contextual entities.
 */
export const LLM_ENTITY_EXTRACTION_CONFIG = {
  /** Minimum content length (chars) to trigger LLM extraction */
  minContentLength: 200,

  /** Minimum confidence threshold for accepting LLM entities */
  minConfidence: 0.65,

  /** Maximum entities to extract per observation */
  maxEntities: 15,

  /** Model temperature for consistent extraction */
  temperature: 0.2,

  /** Debounce window to prevent duplicate processing (ms) */
  debounceMs: 60_000, // 1 minute
} as const;

export type LLMEntityExtractionConfig = typeof LLM_ENTITY_EXTRACTION_CONFIG;

/**
 * Classification Configuration
 *
 * Controls the LLM-based classification of observations.
 * Uses Claude Haiku for semantic classification with fallback to regex.
 */
const CLASSIFICATION_CONFIG = {
  /** Model for classification */
  model: "anthropic/claude-3-5-haiku-latest" as const,

  /** Temperature for classification (lower = more deterministic) */
  temperature: 0.2,

  /** Minimum confidence to trust LLM classification */
  minConfidence: 0.6,

  /** Use fallback regex for events below this significance score */
  fallbackThreshold: 30,
} as const;

type ClassificationConfig = typeof CLASSIFICATION_CONFIG;

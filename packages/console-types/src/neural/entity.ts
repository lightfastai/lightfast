import type { EntityCategory } from "@repo/console-validation";

/**
 * Entity extracted from observation content
 */
export interface ExtractedEntity {
  /** Entity classification */
  category: EntityCategory;
  /** Canonical key (e.g., "@sarah", "POST /api/users", "#123") */
  key: string;
  /** Human-readable value/description */
  value?: string;
  /** Extraction confidence (0.0 - 1.0) */
  confidence: number;
  /** Text snippet providing extraction context */
  evidence: string;
}

/**
 * Entity search result for hybrid retrieval
 */
export interface EntitySearchResult {
  /** Entity database ID */
  entityId: string;
  /** Entity key */
  entityKey: string;
  /** Entity category */
  entityCategory: EntityCategory;
  /** Linked observation ID */
  observationId: string;
  /** Observation title */
  observationTitle: string;
  /** Content snippet */
  observationSnippet: string;
  /** How many times this entity has been seen */
  occurrenceCount: number;
  /** Extraction confidence */
  confidence: number;
}

// Re-export LLM entity extraction types
export type {
  LLMExtractedEntity,
  LLMEntityExtractionResponse,
} from "@repo/console-validation";

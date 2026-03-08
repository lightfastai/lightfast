import type { EntityCategory } from "@repo/console-validation";

/**
 * Entity extracted from observation content
 */
export interface ExtractedEntity {
  /** Entity classification */
  category: EntityCategory;
  /** Extraction confidence (0.0 - 1.0) */
  confidence: number;
  /** Text snippet providing extraction context */
  evidence: string;
  /** Canonical key (e.g., "@sarah", "POST /api/users", "#123") */
  key: string;
  /** Human-readable value/description */
  value?: string;
}

/**
 * Entity search result for hybrid retrieval
 */
export interface EntitySearchResult {
  /** Extraction confidence */
  confidence: number;
  /** Entity category */
  entityCategory: EntityCategory;
  /** Entity database ID */
  entityId: string;
  /** Entity key */
  entityKey: string;
  /** Linked observation ID */
  observationId: string;
  /** Content snippet */
  observationSnippet: string;
  /** Observation title */
  observationTitle: string;
  /** How many times this entity has been seen */
  occurrenceCount: number;
}

// Re-export LLM entity extraction types
export type {
  LLMEntityExtractionResponse,
  LLMExtractedEntity,
} from "@repo/console-validation";

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

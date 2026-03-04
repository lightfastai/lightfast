/**
 * Post-Transform Validation & Types
 *
 * PostTransformEvent is the canonical shape produced by pre-transformers
 * and stored as JSONB in workspace_events. The Zod schema and TypeScript
 * types are defined in @repo/console-validation — this module provides
 * the validation wrapper used by transform functions.
 */

export { validatePostTransformEvent, sanitizePostTransformEvent, type ValidationResult } from "./validation";

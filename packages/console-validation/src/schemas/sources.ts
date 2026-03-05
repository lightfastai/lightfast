/**
 * Source and Integration Type Schemas
 *
 * Type definitions for external integrations and data sources.
 * Used across user sources, workspace sources, and document indexing.
 */

import { z } from "zod";

export const sourceTypeSchema = z.enum(["github", "vercel", "linear", "sentry"]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const syncStatusSchema = z.enum(["success", "failed", "pending"]);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

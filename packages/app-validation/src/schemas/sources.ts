/**
 * Source and Integration Type Schemas
 *
 * SourceType and sourceTypeSchema are now defined in @repo/app-providers
 * (derived from the PROVIDERS registry). Import them directly from there.
 */

import { z } from "zod";

export const syncStatusSchema = z.enum(["success", "failed", "pending"]);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

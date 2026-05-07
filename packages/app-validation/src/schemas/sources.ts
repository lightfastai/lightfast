/**
 * Source and Integration Type Schemas
 *
 * Provider-derived source/integration types were removed in the v2 barebones
 * reset; only the sync-status enum survives here.
 */

import { z } from "zod";

export const syncStatusSchema = z.enum(["success", "failed", "pending"]);
export type SyncStatus = z.infer<typeof syncStatusSchema>;

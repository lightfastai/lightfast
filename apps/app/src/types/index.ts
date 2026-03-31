/**
 * Centralized type definitions for Console app
 *
 * All types extracted from tRPC RouterOutputs - never import from @db/app/schema directly!
 */

import type { RouterOutputs } from "@repo/app-trpc/types";

// ============================================================================
// Jobs
// ============================================================================

export type JobsListResponse = RouterOutputs["jobs"]["list"];
export type Job = JobsListResponse["items"][number];
export type JobStatus = Job["status"];

// ============================================================================
// Sources & Store (granular endpoints)
// Note: Each workspace has exactly ONE store (1:1 relationship)
// ============================================================================

export type SourcesList = RouterOutputs["workspace"]["sources"]["list"];
export type Source = SourcesList["list"][number];


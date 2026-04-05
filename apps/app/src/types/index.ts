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
// Sources & Connections
// ============================================================================

export type ResourcesList = RouterOutputs["connections"]["resources"]["list"];
export type Source = ResourcesList["list"][number];

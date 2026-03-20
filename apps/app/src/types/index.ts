/**
 * Centralized type definitions for Console app
 *
 * All types extracted from tRPC RouterOutputs - never import from @db/console/schema directly!
 */

import type { RouterInputs, RouterOutputs } from "@repo/console-trpc/types";

// ============================================================================
// Jobs
// ============================================================================

export type JobsListResponse = RouterOutputs["jobs"]["list"];
export type Job = JobsListResponse["items"][number];
export type JobStatus = Job["status"];
export type JobTrigger = Job["trigger"];

// Job utility types
export type RunningJob = Job & { status: "running" };
export type CompletedJob = Job & { status: "completed" };
export type FailedJob = Job & { status: "failed" };

// ============================================================================
// Workspace
// ============================================================================

export type Workspace =
  RouterOutputs["workspace"]["listByClerkOrgSlug"][number];
export type WorkspaceDetail = RouterOutputs["workspace"]["getByName"];

// ============================================================================
// Sources & Store (granular endpoints)
// Note: Each workspace has exactly ONE store (1:1 relationship)
// ============================================================================

export type SourcesList = RouterOutputs["workspace"]["sources"]["list"];
export type Source = SourcesList["list"][number];

// Store type (1:1 relationship: each workspace has exactly one store)
export type Store = NonNullable<RouterOutputs["workspace"]["store"]["get"]>;

// ============================================================================
// Integration
// ============================================================================

export type EnrichedConnection =
  RouterOutputs["workspace"]["sources"]["list"]["list"][number];

// ============================================================================
// Organization
// ============================================================================

export type Organization =
  RouterOutputs["organization"]["listUserOrganizations"][number];

// ============================================================================
// Re-exports (for advanced usage)
// ============================================================================

export type { RouterOutputs, RouterInputs };

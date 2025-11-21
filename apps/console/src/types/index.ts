/**
 * Centralized type definitions for Console app
 *
 * All types extracted from tRPC RouterOutputs - never import from @db/console/schema directly!
 */

import type { RouterOutputs, RouterInputs } from "@repo/console-trpc/types";

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

// Recent job type (subset returned by workspace.statistics)
export type RecentJob = Pick<Job, "id" | "name" | "status" | "trigger" | "createdAt" | "completedAt" | "durationMs" | "errorMessage">;

// ============================================================================
// Workspace
// ============================================================================

export type Workspace = RouterOutputs["workspace"]["listByClerkOrgSlug"][number];
export type WorkspaceResolution = RouterOutputs["workspace"]["resolveFromClerkOrgSlug"];
export type WorkspaceResolutionFromOrgId = RouterOutputs["workspace"]["resolveFromClerkOrgId"];
export type WorkspaceStats = RouterOutputs["workspace"]["statistics"];

// Workspace performance metrics
export type JobPercentiles = RouterOutputs["workspace"]["jobPercentiles"];
export type PerformanceTimeSeries = RouterOutputs["workspace"]["performanceTimeSeries"];
export type PerformanceTimeSeriesPoint = PerformanceTimeSeries[number];

// ============================================================================
// Sources & Stores (from workspace.statistics)
// ============================================================================

export type Source = WorkspaceStats["sources"]["list"][number];
export type Store = WorkspaceStats["stores"]["list"][number];

// ============================================================================
// Workspace Statistics Helpers (for component props)
// ============================================================================

/**
 * Helper types for extracting specific metrics from WorkspaceStats
 * Used by presentational components that receive individual stat fields
 */
export type WorkspaceMetricsSummary = {
  sourcesCount: WorkspaceStats["sources"]["total"];
  totalDocuments: WorkspaceStats["documents"]["total"];
  totalChunks: WorkspaceStats["documents"]["chunks"];
  successRate: WorkspaceStats["jobs"]["successRate"];
  avgDurationMs: WorkspaceStats["jobs"]["avgDurationMs"];
  recentJobsCount: WorkspaceStats["jobs"]["total"];
};

// ============================================================================
// Integration
// ============================================================================

export type EnrichedConnection = RouterOutputs["integration"]["workspace"]["list"][number];
export type GitHubIntegration = RouterOutputs["integration"]["github"]["list"];

// ============================================================================
// Organization
// ============================================================================

export type Organization = RouterOutputs["organization"]["listUserOrganizations"][number];
export type OrganizationDetail = RouterOutputs["organization"]["findByClerkOrgSlug"];
export type OrganizationDetailFromOrgId = RouterOutputs["organization"]["findByClerkOrgId"];

// ============================================================================
// System Health
// ============================================================================

export type SystemHealth = RouterOutputs["workspace"]["systemHealth"];

// ============================================================================
// Re-exports (for advanced usage)
// ============================================================================

export type { RouterOutputs, RouterInputs };

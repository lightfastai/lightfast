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

// Recent job type (subset returned by workspace.jobs.recent)
export type RecentJob = RouterOutputs["workspace"]["jobs"]["recent"][number];

// ============================================================================
// Workspace
// ============================================================================

export type Workspace = RouterOutputs["workspace"]["listByClerkOrgSlug"][number];
export type WorkspaceDetail = RouterOutputs["workspace"]["getByName"];

// Workspace performance metrics
export type JobPercentiles = RouterOutputs["workspace"]["jobPercentiles"];
export type PerformanceTimeSeries = RouterOutputs["workspace"]["performanceTimeSeries"];
export type PerformanceTimeSeriesPoint = PerformanceTimeSeries[number];

// ============================================================================
// Sources & Stores (granular endpoints)
// ============================================================================

export type SourcesList = RouterOutputs["workspace"]["sources"]["list"];
export type Source = SourcesList["list"][number];

export type StoresList = RouterOutputs["workspace"]["stores"]["list"];
export type Store = StoresList["list"][number];

export type DocumentsStats = RouterOutputs["workspace"]["documents"]["stats"];
export type JobsStats = RouterOutputs["workspace"]["jobs"]["stats"];

// ============================================================================
// Workspace Statistics Helpers (for component props)
// ============================================================================

/**
 * Helper types for extracting specific metrics from granular endpoints
 * Used by presentational components that receive individual stat fields
 */
export interface WorkspaceMetricsSummary {
  sourcesCount: SourcesList["total"];
  totalDocuments: DocumentsStats["total"];
  totalChunks: DocumentsStats["chunks"];
  successRate: JobsStats["successRate"];
  avgDurationMs: JobsStats["avgDurationMs"];
  recentJobsCount: JobsStats["total"];
}

// ============================================================================
// Integration
// ============================================================================

export type EnrichedConnection = RouterOutputs["workspace"]["integrations"]["list"][number];
export type GitHubIntegration = RouterOutputs["integration"]["github"]["list"];

// ============================================================================
// Organization
// ============================================================================

export type Organization = RouterOutputs["organization"]["listUserOrganizations"][number];
export type OrganizationDetail = RouterOutputs["organization"]["find"];
// Deprecated: Use OrganizationDetail instead
/** @deprecated Use OrganizationDetail instead - unified find procedure handles both ID and slug */
export type OrganizationDetailFromOrgId = RouterOutputs["organization"]["find"];

// ============================================================================
// System Health
// ============================================================================

export type HealthOverview = RouterOutputs["workspace"]["health"]["overview"];

// ============================================================================
// Re-exports (for advanced usage)
// ============================================================================

export type { RouterOutputs, RouterInputs };

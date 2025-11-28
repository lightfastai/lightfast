/**
 * Workspace Validation Schemas
 *
 * Domain-specific validation for workspace-related operations.
 * Derived from database schemas (insertWorkspaceSchema) for consistency.
 * Used in tRPC procedures and client-side forms.
 */

import { z } from "zod";
import {
  clerkOrgIdSchema,
  clerkUserIdSchema,
  nanoidSchema,
} from "../primitives/ids";
import { clerkOrgSlugSchema } from "../primitives/slugs";
import { workspaceNameSchema } from "../primitives/slugs";

/**
 * Workspace Creation Input Schema
 *
 * Derived from insertWorkspaceSchema - picks only fields needed for creation.
 * All database validation rules (name format, slug format) automatically apply.
 *
 * Used in:
 * - tRPC workspace.create procedure
 * - Client-side workspace creation form
 *
 * @example
 * ```typescript
 * const input = workspaceCreateInputSchema.parse({
 *   clerkOrgId: "org_2abcdef123",
 *   workspaceName: "my-awesome-project",
 * });
 * ```
 */
export const workspaceCreateInputSchema = z.object({
  clerkOrgId: clerkOrgIdSchema,
  workspaceName: workspaceNameSchema,
});

export type WorkspaceCreateInput = z.infer<typeof workspaceCreateInputSchema>;

/**
 * Workspace Update Name Input Schema
 *
 * Derived from insertWorkspaceSchema - uses name validation from database.
 *
 * Used in:
 * - tRPC workspace.updateName procedure
 * - Client-side workspace settings form
 *
 * @example
 * ```typescript
 * const input = workspaceUpdateNameInputSchema.parse({
 *   clerkOrgSlug: "lightfast-ai",
 *   currentName: "old-name",
 *   newName: "new-name",
 * });
 * ```
 */
export const workspaceUpdateNameInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  currentName: workspaceNameSchema,
  newName: workspaceNameSchema,
});

export type WorkspaceUpdateNameInput = z.infer<
  typeof workspaceUpdateNameInputSchema
>;

/**
 * Workspace Resolution Input Schema
 *
 * Used in:
 * - tRPC workspace.resolveFromClerkOrgSlug procedure
 * - tRPC helper: resolveWorkspaceByName()
 *
 * @example
 * ```typescript
 * const input = workspaceResolutionInputSchema.parse({
 *   clerkOrgSlug: "lightfast-ai",
 *   workspaceName: "my-workspace",
 *   userId: "user_2abcdef123",
 * });
 * ```
 */
export const workspaceResolutionInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
  userId: clerkUserIdSchema,
});

export type WorkspaceResolutionInput = z.infer<
  typeof workspaceResolutionInputSchema
>;

/**
 * Workspace List Input Schema
 *
 * Used in:
 * - tRPC workspace.listByClerkOrgSlug procedure
 *
 * @example
 * ```typescript
 * const input = workspaceListInputSchema.parse({
 *   clerkOrgSlug: "lightfast-ai",
 * });
 * ```
 */
export const workspaceListInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
});

export type WorkspaceListInput = z.infer<typeof workspaceListInputSchema>;

/**
 * Workspace Statistics Input Schema
 *
 * Used in:
 * - tRPC workspace.statistics procedure
 *
 * @example
 * ```typescript
 * const input = workspaceStatisticsInputSchema.parse({
 *   clerkOrgSlug: "lightfast-ai",
 *   workspaceName: "my-workspace",
 * });
 * ```
 */
export const workspaceStatisticsInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
});

export type WorkspaceStatisticsInput = z.infer<
  typeof workspaceStatisticsInputSchema
>;

/**
 * Time Range Enum for Analytics
 *
 * Used in workspace performance and analytics queries
 */
export const timeRangeSchema = z.enum(["24h", "7d", "30d"]);

export type TimeRange = z.infer<typeof timeRangeSchema>;

/**
 * Workspace Job Percentiles Input Schema
 *
 * Used in:
 * - tRPC workspace.jobPercentiles procedure
 *
 * @example
 * ```typescript
 * const input = workspaceJobPercentilesInputSchema.parse({
 *   clerkOrgSlug: "lightfast-ai",
 *   workspaceName: "my-workspace",
 *   timeRange: "7d",
 * });
 * ```
 */
export const workspaceJobPercentilesInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
  timeRange: timeRangeSchema,
});

export type WorkspaceJobPercentilesInput = z.infer<
  typeof workspaceJobPercentilesInputSchema
>;

/**
 * Workspace Performance Time Series Input Schema
 *
 * Used in:
 * - tRPC workspace.performanceTimeSeries procedure
 *
 * @example
 * ```typescript
 * const input = workspacePerformanceTimeSeriesInputSchema.parse({
 *   clerkOrgSlug: "lightfast-ai",
 *   workspaceName: "my-workspace",
 *   timeRange: "30d",
 * });
 * ```
 */
export const workspacePerformanceTimeSeriesInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
  timeRange: timeRangeSchema,
});

export type WorkspacePerformanceTimeSeriesInput = z.infer<
  typeof workspacePerformanceTimeSeriesInputSchema
>;

/**
 * Workspace Integration Disconnect Input Schema
 *
 * Used in:
 * - tRPC workspace.integrations.disconnect procedure
 *
 * @example
 * ```typescript
 * const input = workspaceIntegrationDisconnectInputSchema.parse({
 *   integrationId: "V1StGXR8_Z5jdHi6B-myT",
 * });
 * ```
 */
export const workspaceIntegrationDisconnectInputSchema = z.object({
  integrationId: nanoidSchema,
});

export type WorkspaceIntegrationDisconnectInput = z.infer<
  typeof workspaceIntegrationDisconnectInputSchema
>;

/**
 * Workspace Resolve from GitHub Org Slug Input Schema
 *
 * Used in:
 * - tRPC workspace.resolveFromGithubOrgSlug procedure (public, used by webhooks)
 */
export const workspaceResolveFromGithubOrgSlugInputSchema = z.object({
  githubOrgSlug: z.string().min(1, "GitHub organization slug must not be empty"),
});

export type WorkspaceResolveFromGithubOrgSlugInput = z.infer<
  typeof workspaceResolveFromGithubOrgSlugInputSchema
>;

/**
 * Workspace Statistics Comparison Input Schema
 *
 * Derived from insertWorkspaceSchema for ID validation.
 *
 * Used in:
 * - tRPC workspace.statisticsComparison procedure
 */
export const workspaceStatisticsComparisonInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
  currentStart: z.string(), // ISO datetime
  currentEnd: z.string(), // ISO datetime
  previousStart: z.string(), // ISO datetime
  previousEnd: z.string(), // ISO datetime
});

export type WorkspaceStatisticsComparisonInput = z.infer<
  typeof workspaceStatisticsComparisonInputSchema
>;

/**
 * Workspace System Health Input Schema
 *
 * Used in:
 * - tRPC workspace.systemHealth procedure
 *
 * @example
 * ```typescript
 * const input = workspaceSystemHealthInputSchema.parse({
 *   clerkOrgSlug: "lightfast-ai",
 *   workspaceName: "my-workspace",
 * });
 * ```
 */
export const workspaceSystemHealthInputSchema = z.object({
  clerkOrgSlug: clerkOrgSlugSchema,
  workspaceName: workspaceNameSchema,
});

export type WorkspaceSystemHealthInput = z.infer<
  typeof workspaceSystemHealthInputSchema
>;

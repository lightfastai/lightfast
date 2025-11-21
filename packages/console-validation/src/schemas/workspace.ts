/**
 * Workspace Validation Schemas
 *
 * Domain-specific validation for workspace-related operations.
 * Used in tRPC procedures and client-side forms.
 */

import { z } from "zod";
import {
  clerkOrgIdSchema,
  clerkUserIdSchema,
  nanoidSchema,
} from "../primitives/ids";
import { workspaceNameSchema, workspaceSlugSchema, clerkOrgSlugSchema } from "../primitives/slugs";

/**
 * Workspace Creation Input Schema
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
 *   workspaceId: "V1StGXR8_Z5jdHi6B-myT",
 *   clerkOrgId: "org_2abcdef123",
 *   timeRange: "7d",
 * });
 * ```
 */
export const workspaceJobPercentilesInputSchema = z.object({
  workspaceId: nanoidSchema,
  clerkOrgId: clerkOrgIdSchema,
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
 *   workspaceId: "V1StGXR8_Z5jdHi6B-myT",
 *   clerkOrgId: "org_2abcdef123",
 *   timeRange: "30d",
 * });
 * ```
 */
export const workspacePerformanceTimeSeriesInputSchema = z.object({
  workspaceId: nanoidSchema,
  clerkOrgId: clerkOrgIdSchema,
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

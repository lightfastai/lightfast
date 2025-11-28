/**
 * @repo/console-auth-middleware
 *
 * Authorization middleware utilities for Console tRPC API
 *
 * This package provides security-focused utilities for:
 * - **Workspace Access Verification** - Validate user has access to workspace
 * - **Resource Ownership Verification** - Check user owns integrations, API keys, repositories
 * - **Tenant Isolation Helpers** - Helper functions for Drizzle tenant isolation queries
 *
 * ## Key Features
 *
 * - ✅ **Dependency Injection** - Accepts DbClient as parameter (easy to mock in tests)
 * - ✅ **Structured Results** - Returns detailed results with clear error types
 * - ✅ **Type-Safe** - Full TypeScript support with comprehensive JSDoc
 * - ✅ **Reusable** - Designed for use in tRPC middleware and procedures
 * - ✅ **Security-First** - Implements authorization patterns from security review
 *
 * @example
 * ```typescript
 * import { verifyWorkspaceAccess } from "@repo/console-auth-middleware";
 * import { db } from "@db/console/client";
 *
 * // In a tRPC procedure
 * const result = await verifyWorkspaceAccess({
 *   userId: ctx.auth.userId,
 *   clerkOrgSlug: input.clerkOrgSlug,
 *   workspaceName: input.workspaceName,
 *   db,
 * });
 *
 * if (!result.success) {
 *   throw new TRPCError({
 *     code: result.errorCode,
 *     message: result.error,
 *   });
 * }
 *
 * const { workspaceId, clerkOrgId } = result.data;
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Database client
  DbClient,
  ResourceType,
  AuthErrorCode,
  UserRole,
  // Workspace access
  WorkspaceAccessContext,
  WorkspaceAccessData,
  WorkspaceAccessResult,
  // Workspace resolution
  ResolveWorkspaceByNameContext,
  ResolveWorkspaceBySlugContext,
  ResolveWorkspaceData,
  ResolveWorkspaceResult,
  // Resource ownership
  ResourceOwnershipContext,
  ResourceOwnershipData,
  ResourceOwnershipResult,
  // Tenant isolation
  TenantFilter,
  // Organization access
  OrgAccessContext,
  OrgAccessData,
  OrgAccessResult,
} from "./types";

// ============================================================================
// Workspace Access Exports
// ============================================================================

export {
  verifyWorkspaceAccess,
  resolveWorkspaceByName,
  resolveWorkspaceBySlug,
  verifyOrgAccess,
} from "./workspace";

// ============================================================================
// Resource Ownership Exports
// ============================================================================

export {
  verifyResourceOwnership,
  verifyMultipleResourceOwnership,
  assertResourceOwnership,
} from "./resources";

// ============================================================================
// Tenant Isolation Exports
// ============================================================================

export {
  createTenantFilter,
  isValidTenantId,
  extractTenantId,
  createTenantFilterFromWorkspace,
  assertTenantIdsMatch,
  belongsToTenant,
  filterResourcesByTenant,
  createMultiTenantFilter,
} from "./tenant";

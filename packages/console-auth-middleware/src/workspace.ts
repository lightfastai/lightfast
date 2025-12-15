/**
 * Workspace Access Verification
 *
 * This module provides functions for verifying user access to workspaces
 * and resolving workspace identifiers from user-provided slugs/names.
 *
 * Security principles:
 * 1. Never trust user-provided IDs - always resolve from slugs
 * 2. Verify org membership via Clerk before database queries
 * 3. Return structured results with clear error codes
 * 4. Use dependency injection for testability
 *
 * @example
 * ```typescript
 * import { verifyWorkspaceAccess } from "@repo/console-auth-middleware";
 * import { db } from "@db/console/client";
 *
 * const result = await verifyWorkspaceAccess({
 *   userId: "user_123",
 *   clerkOrgSlug: "acme-corp",
 *   workspaceName: "my-project",
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

import { eq, and } from "drizzle-orm";
import { orgWorkspaces } from "@db/console/schema";
import type {
  DbClient,
  WorkspaceAccessContext,
  WorkspaceAccessResult,
  ResolveWorkspaceByNameContext,
  ResolveWorkspaceBySlugContext,
  ResolveWorkspaceResult,
  OrgAccessContext,
  OrgAccessResult,
} from "./types";

/**
 * Verify organization access via Clerk
 *
 * Strategy: User-centric lookup with caching - fetches user's orgs (typically 1-5)
 * instead of org's members (could be 100+). This is O(user_orgs) vs O(org_size).
 *
 * This helper:
 * 1. Fetches org by slug from Clerk
 * 2. Gets user's cached memberships
 * 3. Verifies user is a member of the org
 * 4. Returns org ID for database queries
 *
 * @param params - Organization access context
 * @returns Result with clerkOrgId and clerkOrgSlug, or error
 *
 * @example
 * ```typescript
 * const result = await verifyOrgAccess({
 *   clerkOrgSlug: "acme-corp",
 *   userId: "user_123",
 * });
 *
 * if (!result.success) {
 *   throw new TRPCError({
 *     code: result.errorCode,
 *     message: result.error,
 *   });
 * }
 *
 * const { clerkOrgId } = result.data;
 * ```
 */
export async function verifyOrgAccess(
  params: OrgAccessContext
): Promise<OrgAccessResult> {
  try {
    const { clerkClient } = await import("@vendor/clerk/server");
    const clerk = await clerkClient();

    // 1. Fetch org by slug
    let clerkOrg;
    try {
      clerkOrg = await clerk.organizations.getOrganization({
        slug: params.clerkOrgSlug,
      });
    } catch {
      return {
        success: false,
        error: `Organization not found: ${params.clerkOrgSlug}`,
        errorCode: "NOT_FOUND",
      };
    }

    if (!clerkOrg) {
      return {
        success: false,
        error: `Organization not found: ${params.clerkOrgSlug}`,
        errorCode: "NOT_FOUND",
      };
    }

    // 2. User-centric membership check (cached)
    const { getCachedUserOrgMemberships } = await import("@repo/console-clerk-cache");
    const userMemberships = await getCachedUserOrgMemberships(params.userId);

    const userMembership = userMemberships.find(
      (m) => m.organizationId === clerkOrg.id
    );

    if (!userMembership) {
      return {
        success: false,
        error: "Access denied to this organization",
        errorCode: "FORBIDDEN",
      };
    }

    // 3. Return org ID for database queries
    return {
      success: true,
      data: {
        clerkOrgId: clerkOrg.id,
        clerkOrgSlug: params.clerkOrgSlug,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify organization access: ${error instanceof Error ? error.message : "Unknown error"}`,
      errorCode: "INTERNAL_SERVER_ERROR",
    };
  }
}

/**
 * Resolve workspace by user-facing name
 *
 * This function:
 * 1. Verifies org access via Clerk
 * 2. Fetches workspace by name within that org
 * 3. Returns workspace ID, slug, and org ID
 *
 * Use this for user-facing routes where workspace name comes from URL.
 *
 * @param params - Workspace resolution context
 * @returns Result with workspace IDs and org ID, or error
 *
 * @example
 * ```typescript
 * const result = await resolveWorkspaceByName({
 *   clerkOrgSlug: "acme-corp",
 *   workspaceName: "my-project",
 *   userId: "user_123",
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
 * const { workspaceId, workspaceSlug, clerkOrgId } = result.data;
 * ```
 */
export async function resolveWorkspaceByName(
  params: ResolveWorkspaceByNameContext
): Promise<ResolveWorkspaceResult> {
  try {
    // 1. Verify org access first
    const orgResult = await verifyOrgAccess({
      clerkOrgSlug: params.clerkOrgSlug,
      userId: params.userId,
    });

    if (!orgResult.success) {
      return {
        success: false,
        error: orgResult.error,
        errorCode: orgResult.errorCode,
      };
    }

    const { clerkOrgId } = orgResult.data;

    // 2. Fetch workspace by name within this org
    const workspace = await params.db.query.orgWorkspaces.findFirst({
      where: and(
        eq(orgWorkspaces.clerkOrgId, clerkOrgId),
        eq(orgWorkspaces.name, params.workspaceName)
      ),
    });

    if (!workspace) {
      return {
        success: false,
        error: `Workspace not found: ${params.workspaceName}`,
        errorCode: "NOT_FOUND",
      };
    }

    // 3. Return workspace ID, name, and internal slug
    return {
      success: true,
      data: {
        workspaceId: workspace.id,
        workspaceName: params.workspaceName,
        workspaceSlug: workspace.slug,
        clerkOrgId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to resolve workspace: ${error instanceof Error ? error.message : "Unknown error"}`,
      errorCode: "INTERNAL_SERVER_ERROR",
    };
  }
}

/**
 * Resolve workspace by internal slug
 *
 * ⚠️ INTERNAL USE ONLY - DO NOT USE IN USER-FACING ROUTES
 *
 * This function queries by the internal `slug` field (e.g., "robust-chicken"),
 * which is used for Pinecone namespace naming and other internal operations.
 *
 * For user-facing URLs, ALWAYS use `resolveWorkspaceByName` instead,
 * which queries by the user-provided `name` field (e.g., "My Cool Project").
 *
 * @param params - Workspace resolution context
 * @returns Result with workspace IDs and org ID, or error
 *
 * @example
 * ```typescript
 * // Internal operation (e.g., Pinecone namespace lookup)
 * const result = await resolveWorkspaceBySlug({
 *   clerkOrgSlug: "acme-corp",
 *   workspaceSlug: "robust-chicken",
 *   userId: "user_123",
 *   db,
 * });
 * ```
 */
export async function resolveWorkspaceBySlug(
  params: ResolveWorkspaceBySlugContext
): Promise<ResolveWorkspaceResult> {
  try {
    // 1. Verify org access first
    const orgResult = await verifyOrgAccess({
      clerkOrgSlug: params.clerkOrgSlug,
      userId: params.userId,
    });

    if (!orgResult.success) {
      return {
        success: false,
        error: orgResult.error,
        errorCode: orgResult.errorCode,
      };
    }

    const { clerkOrgId } = orgResult.data;

    // 2. Fetch workspace by slug within this org
    const workspace = await params.db.query.orgWorkspaces.findFirst({
      where: and(
        eq(orgWorkspaces.clerkOrgId, clerkOrgId),
        eq(orgWorkspaces.slug, params.workspaceSlug)
      ),
    });

    if (!workspace) {
      return {
        success: false,
        error: `Workspace not found (internal slug): ${params.workspaceSlug}`,
        errorCode: "NOT_FOUND",
      };
    }

    // 3. Return workspace ID and slug
    return {
      success: true,
      data: {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        workspaceSlug: params.workspaceSlug,
        clerkOrgId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to resolve workspace: ${error instanceof Error ? error.message : "Unknown error"}`,
      errorCode: "INTERNAL_SERVER_ERROR",
    };
  }
}

/**
 * Verify workspace access (all-in-one)
 *
 * This is the primary function for workspace authorization. It:
 * 1. Verifies org access via Clerk
 * 2. Resolves workspace by name
 * 3. Returns workspace ID, org ID, and user role
 *
 * Use this at the start of tRPC procedures that operate on workspace-scoped resources.
 *
 * @param params - Workspace access context
 * @returns Result with workspace data and user role, or error
 *
 * @example
 * ```typescript
 * // In a tRPC procedure
 * myProcedure: protectedProcedure
 *   .input(z.object({
 *     clerkOrgSlug: z.string(),
 *     workspaceName: z.string(),
 *   }))
 *   .query(async ({ ctx, input }) => {
 *     const result = await verifyWorkspaceAccess({
 *       userId: ctx.auth.userId,
 *       clerkOrgSlug: input.clerkOrgSlug,
 *       workspaceName: input.workspaceName,
 *       db: ctx.db,
 *     });
 *
 *     if (!result.success) {
 *       throw new TRPCError({
 *         code: result.errorCode,
 *         message: result.error,
 *       });
 *     }
 *
 *     const { workspaceId, clerkOrgId } = result.data;
 *
 *     // Now safe to query workspace-scoped resources
 *     // ...
 *   });
 * ```
 */
export async function verifyWorkspaceAccess(
  params: WorkspaceAccessContext
): Promise<WorkspaceAccessResult> {
  try {
    // 1. Verify org access and get org info
    const { clerkClient } = await import("@vendor/clerk/server");
    const clerk = await clerkClient();

    let clerkOrg;
    try {
      clerkOrg = await clerk.organizations.getOrganization({
        slug: params.clerkOrgSlug,
      });
    } catch {
      return {
        success: false,
        error: `Organization not found: ${params.clerkOrgSlug}`,
        errorCode: "NOT_FOUND",
      };
    }

    if (!clerkOrg) {
      return {
        success: false,
        error: `Organization not found: ${params.clerkOrgSlug}`,
        errorCode: "NOT_FOUND",
      };
    }

    // 2. User-centric membership check (cached)
    const { getCachedUserOrgMemberships } = await import("@repo/console-clerk-cache");
    const userMemberships = await getCachedUserOrgMemberships(params.userId);

    const userMembership = userMemberships.find(
      (m) => m.organizationId === clerkOrg.id
    );

    if (!userMembership) {
      return {
        success: false,
        error: "Access denied to this organization",
        errorCode: "FORBIDDEN",
      };
    }

    const clerkOrgId = clerkOrg.id;
    const userRole = userMembership.role;

    // 3. Fetch workspace by name within this org
    const workspace = await params.db.query.orgWorkspaces.findFirst({
      where: and(
        eq(orgWorkspaces.clerkOrgId, clerkOrgId),
        eq(orgWorkspaces.name, params.workspaceName)
      ),
    });

    if (!workspace) {
      return {
        success: false,
        error: `Workspace not found: ${params.workspaceName}`,
        errorCode: "NOT_FOUND",
      };
    }

    // 4. Return complete workspace access data
    return {
      success: true,
      data: {
        workspaceId: workspace.id,
        workspaceName: params.workspaceName,
        workspaceSlug: workspace.slug,
        clerkOrgId,
        userRole,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify workspace access: ${error instanceof Error ? error.message : "Unknown error"}`,
      errorCode: "INTERNAL_SERVER_ERROR",
    };
  }
}

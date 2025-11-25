/**
 * Resource Ownership Verification
 *
 * This module provides functions for verifying user ownership of resources:
 * - Integrations (GitHub, Notion, Linear, etc.)
 * - API Keys
 * - Repositories (via integration ownership)
 *
 * Security principles:
 * 1. Always verify ownership before mutations
 * 2. Return structured results with clear error codes
 * 3. Use dependency injection for testability
 * 4. Support multiple resource types with type safety
 *
 * @example
 * ```typescript
 * import { verifyResourceOwnership } from "@repo/console-auth-middleware";
 * import { db } from "@db/console/client";
 *
 * const result = await verifyResourceOwnership({
 *   userId: "user_123",
 *   resourceId: "integration_abc",
 *   resourceType: "integration",
 *   db,
 * });
 *
 * if (!result.success) {
 *   throw new TRPCError({
 *     code: "FORBIDDEN",
 *     message: result.error,
 *   });
 * }
 *
 * const integration = result.data.resource;
 * ```
 */

import { eq } from "drizzle-orm";
import {
  userApiKeys,
  userSources,
  workspaceIntegrations,
} from "@db/console/schema";
import type {
  ResourceOwnershipContext,
  ResourceOwnershipResult,
} from "./types";

/**
 * Verify user owns an integration
 *
 * Integrations are personal OAuth connections (GitHub, Notion, etc.)
 * that are tied to a specific user.
 *
 * @param userId - User ID to check ownership
 * @param integrationId - Integration ID to verify
 * @param db - Database client instance
 * @returns Result with authorization status and resource
 */
async function verifyIntegrationOwnership(
  userId: string,
  integrationId: string,
  db: ResourceOwnershipContext["db"]
): Promise<ResourceOwnershipResult> {
  try {
    const userSource = await db.query.userSources.findFirst({
      where: eq(userSources.id, integrationId),
    });

    if (!userSource) {
      return {
        success: true,
        data: {
          authorized: false,
        },
      };
    }

    // Check if user owns this integration
    const authorized = userSource.userId === userId;

    return {
      success: true,
      data: {
        authorized,
        resource: authorized ? userSource : undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify integration ownership: ${error instanceof Error ? error.message : "Unknown error"}`,
      errorCode: "INTERNAL_SERVER_ERROR",
    };
  }
}

/**
 * Verify user owns an API key
 *
 * API keys are tied to a specific user and used for CLI authentication.
 *
 * @param userId - User ID to check ownership
 * @param apiKeyId - API key ID to verify
 * @param db - Database client instance
 * @returns Result with authorization status and resource
 */
async function verifyApiKeyOwnership(
  userId: string,
  apiKeyId: string,
  db: ResourceOwnershipContext["db"]
): Promise<ResourceOwnershipResult> {
  try {
    const apiKey = await db.query.userApiKeys.findFirst({
      where: eq(userApiKeys.id, apiKeyId),
    });

    if (!apiKey) {
      return {
        success: true,
        data: {
          authorized: false,
        },
      };
    }

    // Check if user owns this API key
    const authorized = apiKey.userId === userId;

    return {
      success: true,
      data: {
        authorized,
        resource: authorized ? apiKey : undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify API key ownership: ${error instanceof Error ? error.message : "Unknown error"}`,
      errorCode: "INTERNAL_SERVER_ERROR",
    };
  }
}

/**
 * Verify user owns a repository (via integration)
 *
 * Repositories are workspace sources, so ownership is verified by:
 * 1. Finding the workspace source
 * 2. Finding the parent user source
 * 3. Checking if the user owns the parent user source
 *
 * @param userId - User ID to check ownership
 * @param resourceId - Workspace source ID to verify
 * @param db - Database client instance
 * @returns Result with authorization status and resource
 */
async function verifyRepositoryOwnership(
  userId: string,
  resourceId: string,
  db: ResourceOwnershipContext["db"]
): Promise<ResourceOwnershipResult> {
  try {
    // Find the workspace source
    const source = await db.query.workspaceIntegrations.findFirst({
      where: eq(workspaceIntegrations.id, resourceId),
    });

    if (!source) {
      return {
        success: true,
        data: {
          authorized: false,
        },
      };
    }

    // Find the parent user source
    const userSource = await db.query.userSources.findFirst({
      where: eq(userSources.id, source.userSourceId),
    });

    if (!userSource) {
      return {
        success: true,
        data: {
          authorized: false,
        },
      };
    }

    // Check if user owns the parent user source
    const authorized = userSource.userId === userId;

    return {
      success: true,
      data: {
        authorized,
        resource: authorized ? source : undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify repository ownership: ${error instanceof Error ? error.message : "Unknown error"}`,
      errorCode: "INTERNAL_SERVER_ERROR",
    };
  }
}

/**
 * Verify user owns a user source (NEW 2-table system)
 *
 * User sources are personal OAuth connections (GitHub, Notion, etc.)
 * that are tied to a specific user.
 *
 * @param userId - User ID to check ownership
 * @param userSourceId - User source ID to verify
 * @param db - Database client instance
 * @returns Result with authorization status and resource
 */
async function verifyUserSourceOwnership(
  userId: string,
  userSourceId: string,
  db: ResourceOwnershipContext["db"]
): Promise<ResourceOwnershipResult> {
  try {
    const userSource = await db.query.userSources.findFirst({
      where: eq(userSources.id, userSourceId),
    });

    if (!userSource) {
      return {
        success: true,
        data: {
          authorized: false,
        },
      };
    }

    // Check if user owns this user source
    const authorized = userSource.userId === userId;

    return {
      success: true,
      data: {
        authorized,
        resource: authorized ? userSource : undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify user source ownership: ${error instanceof Error ? error.message : "Unknown error"}`,
      errorCode: "INTERNAL_SERVER_ERROR",
    };
  }
}

/**
 * Verify user owns a resource
 *
 * This is the primary function for resource ownership verification.
 * It dispatches to the appropriate ownership checker based on resource type.
 *
 * Use this before allowing mutations on user-owned resources.
 *
 * @param params - Resource ownership context
 * @returns Result with authorization status and resource, or error
 *
 * @example
 * ```typescript
 * // In a tRPC procedure
 * deleteIntegration: protectedProcedure
 *   .input(z.object({ integrationId: z.string() }))
 *   .mutation(async ({ ctx, input }) => {
 *     // Verify ownership before deletion
 *     const result = await verifyResourceOwnership({
 *       userId: ctx.auth.userId,
 *       resourceId: input.integrationId,
 *       resourceType: "integration",
 *       db: ctx.db,
 *     });
 *
 *     if (!result.success) {
 *       throw new TRPCError({
 *         code: "INTERNAL_SERVER_ERROR",
 *         message: result.error,
 *       });
 *     }
 *
 *     if (!result.data.authorized) {
 *       throw new TRPCError({
 *         code: "FORBIDDEN",
 *         message: "You don't own this integration",
 *       });
 *     }
 *
 *     // Now safe to delete
 *     await ctx.db.delete(integrations)
 *       .where(eq(integrations.id, input.integrationId));
 *
 *     return { success: true };
 *   });
 * ```
 */
export async function verifyResourceOwnership(
  params: ResourceOwnershipContext
): Promise<ResourceOwnershipResult> {
  const { userId, resourceId, resourceType, db } = params;

  // Dispatch to appropriate ownership checker
  switch (resourceType) {
    case "integration":
      return verifyIntegrationOwnership(userId, resourceId, db);

    case "apiKey":
      return verifyApiKeyOwnership(userId, resourceId, db);

    case "repository":
      return verifyRepositoryOwnership(userId, resourceId, db);

    case "userSource":
      return verifyUserSourceOwnership(userId, resourceId, db);

    default:
      return {
        success: false,
        error: `Unknown resource type: ${resourceType}`,
        errorCode: "BAD_REQUEST",
      };
  }
}

/**
 * Verify multiple resources are owned by user
 *
 * Convenience function for batch ownership verification.
 * All resources must be of the same type.
 *
 * @param params - Resource ownership context with multiple IDs
 * @returns Result with authorization status for each resource
 *
 * @example
 * ```typescript
 * const results = await verifyMultipleResourceOwnership({
 *   userId: "user_123",
 *   resourceIds: ["int_1", "int_2", "int_3"],
 *   resourceType: "integration",
 *   db,
 * });
 *
 * // Check if all are authorized
 * const allAuthorized = results.every(r => r.success && r.data.authorized);
 * ```
 */
export async function verifyMultipleResourceOwnership(
  params: Omit<ResourceOwnershipContext, "resourceId"> & {
    resourceIds: string[];
  }
): Promise<ResourceOwnershipResult[]> {
  const { userId, resourceIds, resourceType, db } = params;

  // Verify each resource in parallel
  const results = await Promise.all(
    resourceIds.map((resourceId) =>
      verifyResourceOwnership({
        userId,
        resourceId,
        resourceType,
        db,
      })
    )
  );

  return results;
}

/**
 * Assert user owns resource (throws if not)
 *
 * Convenience function that throws a TRPCError if user doesn't own the resource.
 * Use this to reduce boilerplate in tRPC procedures.
 *
 * @param params - Resource ownership context
 * @throws {TRPCError} FORBIDDEN if user doesn't own resource
 * @throws {TRPCError} NOT_FOUND if resource doesn't exist
 * @returns The verified resource
 *
 * @example
 * ```typescript
 * import { assertResourceOwnership } from "@repo/console-auth-middleware";
 * import { TRPCError } from "@trpc/server";
 *
 * // In a tRPC procedure
 * deleteIntegration: protectedProcedure
 *   .input(z.object({ integrationId: z.string() }))
 *   .mutation(async ({ ctx, input }) => {
 *     // Throws if not authorized
 *     const integration = await assertResourceOwnership({
 *       userId: ctx.auth.userId,
 *       resourceId: input.integrationId,
 *       resourceType: "integration",
 *       db: ctx.db,
 *     });
 *
 *     // Now safe to use integration
 *     await ctx.db.delete(integrations)
 *       .where(eq(integrations.id, integration.id));
 *
 *     return { success: true };
 *   });
 * ```
 */
export async function assertResourceOwnership(
  params: ResourceOwnershipContext
): Promise<unknown> {
  const result = await verifyResourceOwnership(params);

  if (!result.success) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({
      code: result.errorCode,
      message: result.error,
    });
  }

  if (!result.data.authorized) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `You don't own this ${params.resourceType}`,
    });
  }

  if (!result.data.resource) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `${params.resourceType} not found`,
    });
  }

  return result.data.resource;
}

/**
 * Resource Ownership Verification
 *
 * This module provides functions for verifying user ownership of resources.
 * Post-consolidation: integrations are org-scoped via gw_installations.
 */

import { eq } from "drizzle-orm";
import {
  userApiKeys,
  gwInstallations,
  workspaceIntegrations,
} from "@db/console/schema";
import type {
  ResourceOwnershipContext,
  ResourceOwnershipResult,
} from "./types";

/**
 * Verify user has access to an installation (org-scoped)
 *
 * In the new model, installations are org-scoped. Ownership is verified
 * by checking that the user connected (connectedBy) the installation.
 * Full org membership checks are done at the tRPC procedure level.
 */
async function verifyInstallationAccess(
  userId: string,
  integrationId: string,
  db: ResourceOwnershipContext["db"]
): Promise<ResourceOwnershipResult> {
  try {
    const installation = await db.query.gwInstallations.findFirst({
      where: eq(gwInstallations.id, integrationId),
    });

    if (!installation) {
      return {
        success: true,
        data: {
          authorized: false,
        },
      };
    }

    // Check if user connected this installation
    const authorized = installation.connectedBy === userId;

    return {
      success: true,
      data: {
        authorized,
        resource: authorized ? installation : undefined,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to verify installation access: ${error instanceof Error ? error.message : "Unknown error"}`,
      errorCode: "INTERNAL_SERVER_ERROR",
    };
  }
}

/**
 * Verify user owns an API key
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
 * Verify user has access to a repository (via installation)
 *
 * Ownership is verified by: workspaceIntegrations → gwInstallations.connectedBy
 */
async function verifyRepositoryOwnership(
  userId: string,
  resourceId: string,
  db: ResourceOwnershipContext["db"]
): Promise<ResourceOwnershipResult> {
  try {
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

    if (!source.installationId) {
      return {
        success: true,
        data: {
          authorized: false,
        },
      };
    }

    // Verify via linked installation
    const installation = await db.query.gwInstallations.findFirst({
      where: eq(gwInstallations.id, source.installationId),
    });

    if (!installation) {
      return {
        success: true,
        data: {
          authorized: false,
        },
      };
    }

    const authorized = installation.connectedBy === userId;

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
 * Verify user owns a resource.
 * Dispatches to the appropriate ownership checker based on resource type.
 */
export async function verifyResourceOwnership(
  params: ResourceOwnershipContext
): Promise<ResourceOwnershipResult> {
  const { userId, resourceId, resourceType, db } = params;

  switch (resourceType) {
    case "integration":
      return verifyInstallationAccess(userId, resourceId, db);

    case "apiKey":
      return verifyApiKeyOwnership(userId, resourceId, db);

    case "repository":
      return verifyRepositoryOwnership(userId, resourceId, db);

    default:
      return {
        success: false,
        error: `Unknown resource type: ${resourceType}`,
        errorCode: "BAD_REQUEST",
      };
  }
}

/**
 * Verify multiple resources are owned by user.
 */
export async function verifyMultipleResourceOwnership(
  params: Omit<ResourceOwnershipContext, "resourceId"> & {
    resourceIds: string[];
  }
): Promise<ResourceOwnershipResult[]> {
  const { userId, resourceIds, resourceType, db } = params;

  return Promise.all(
    resourceIds.map((resourceId) =>
      verifyResourceOwnership({
        userId,
        resourceId,
        resourceType,
        db,
      })
    )
  );
}

/**
 * Assert user owns resource (throws if not).
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

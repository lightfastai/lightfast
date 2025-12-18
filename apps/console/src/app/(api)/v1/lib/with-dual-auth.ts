/**
 * Dual Authentication Middleware for v1 Routes
 *
 * Supports both API key and Clerk session authentication.
 * - API key: Uses existing withApiKeyAuth, trusts X-Workspace-ID
 * - Session: Validates workspace access via org membership
 */

import type { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { withApiKeyAuth } from "./with-api-key-auth";

export interface DualAuthContext {
  workspaceId: string;
  userId: string;
  authType: "api-key" | "session";
  apiKeyId?: string;
}

export interface DualAuthSuccess {
  success: true;
  auth: DualAuthContext;
}

export interface DualAuthError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  status: number;
}

export type DualAuthResult = DualAuthSuccess | DualAuthError;

/**
 * Verify authentication via API key OR Clerk session
 *
 * Priority:
 * 1. API key (Authorization: Bearer header) - for external clients
 * 2. Clerk session - for console UI
 *
 * For API key auth: trusts X-Workspace-ID header (existing behavior)
 * For session auth: validates workspace access via org membership
 */
export async function withDualAuth(
  request: NextRequest,
  requestId?: string
): Promise<DualAuthResult> {
  // Check for API key first
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    // API key path - use existing implementation
    const apiKeyResult = await withApiKeyAuth(request, requestId);

    if (!apiKeyResult.success) {
      return apiKeyResult;
    }

    return {
      success: true,
      auth: {
        workspaceId: apiKeyResult.auth.workspaceId,
        userId: apiKeyResult.auth.userId,
        authType: "api-key",
        apiKeyId: apiKeyResult.auth.apiKeyId,
      },
    };
  }

  // Session path - validate via Clerk
  const { userId } = await auth();

  if (!userId) {
    log.warn("No authentication provided", { requestId });
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message:
          "Authentication required. Provide 'Authorization: Bearer <api-key>' header or sign in.",
      },
      status: 401,
    };
  }

  // Session requires X-Workspace-ID header
  const workspaceId = request.headers.get("x-workspace-id");
  if (!workspaceId) {
    log.warn("Missing X-Workspace-ID for session auth", { requestId, userId });
    return {
      success: false,
      error: {
        code: "BAD_REQUEST",
        message:
          "Workspace ID required. Provide 'X-Workspace-ID: <workspace-id>' header.",
      },
      status: 400,
    };
  }

  // Validate workspace access for session users
  const accessResult = await validateWorkspaceAccess(
    workspaceId,
    userId,
    requestId
  );

  if (!accessResult.success) {
    return accessResult;
  }

  log.info("Session auth verified", { requestId, userId, workspaceId });

  return {
    success: true,
    auth: {
      workspaceId,
      userId,
      authType: "session",
    },
  };
}

/**
 * Validate that a Clerk user has access to the specified workspace
 *
 * Security: Verifies org membership via Clerk API before allowing access.
 * This prevents users from accessing workspaces they don't belong to.
 *
 * Optimization: Fetches user's org memberships (typically 1-5 orgs) instead of
 * all org members (could be 100+). This is O(user_orgs) vs O(org_size).
 */
async function validateWorkspaceAccess(
  workspaceId: string,
  userId: string,
  requestId?: string
): Promise<DualAuthResult> {
  try {
    // 1. Fetch workspace to get clerkOrgId
    const workspace = await db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, workspaceId),
      columns: {
        id: true,
        clerkOrgId: true,
      },
    });

    if (!workspace) {
      log.warn("Workspace not found", { requestId, workspaceId });
      return {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "Workspace not found",
        },
        status: 404,
      };
    }

    // 2. Verify user is member of the org (cached lookup)
    const { getCachedUserOrgMemberships } = await import("@repo/console-clerk-cache");
    const userMemberships = await getCachedUserOrgMemberships(userId);

    const isMember = userMemberships.some(
      (m) => m.organizationId === workspace.clerkOrgId
    );

    if (!isMember) {
      log.warn("User not member of workspace org", {
        requestId,
        userId,
        workspaceId,
        orgId: workspace.clerkOrgId,
      });
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Access denied to this workspace",
        },
        status: 403,
      };
    }

    return {
      success: true,
      auth: {
        workspaceId,
        userId,
        authType: "session",
      },
    };
  } catch (error) {
    log.error("Workspace access validation failed", { requestId, error });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to validate workspace access",
      },
      status: 500,
    };
  }
}

/**
 * Helper to create error response from DualAuthError
 */
export function createDualAuthErrorResponse(
  result: DualAuthError,
  requestId: string
): Response {
  return Response.json(
    {
      error: result.error.code,
      message: result.error.message,
      requestId,
    },
    { status: result.status }
  );
}

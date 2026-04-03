/**
 * Dual Authentication Middleware for API Routes
 *
 * Supports both API key and Clerk session authentication.
 * - API key: Uses existing withApiKeyAuth, trusts X-Org-ID
 * - Clerk JWT bearer: Verifies org membership via cached memberships
 * - Session: Validates org membership via Clerk
 */

import { LIGHTFAST_API_KEY_PREFIX } from "@repo/app-api-key";
import { auth } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log/next";
import type { NextRequest } from "next/server";
import { withApiKeyAuth } from "./with-api-key-auth";

export interface DualAuthContext {
  apiKeyId?: string;
  authType: "api-key" | "session";
  clerkOrgId: string;
  userId: string;
}

export interface DualAuthSuccess {
  auth: DualAuthContext;
  success: true;
}

export interface DualAuthError {
  error: {
    code: string;
    message: string;
  };
  status: number;
  success: false;
}

export type DualAuthResult = DualAuthSuccess | DualAuthError;

/**
 * Verify authentication via API key OR Clerk session
 *
 * Priority:
 * 1. API key (Authorization: Bearer header) - for external clients
 * 2. Clerk session - for console UI
 *
 * For API key auth: trusts X-Org-ID header (org established by API key lookup)
 * For Clerk JWT bearer: verifies org membership via cached memberships
 * For session auth: validates org membership via Clerk
 */
export async function withDualAuth(
  request: NextRequest,
  requestId?: string
): Promise<DualAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    // API key path — org established by key lookup, trust X-Org-ID
    if (token.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
      const apiKeyResult = await withApiKeyAuth(request, requestId);
      if (!apiKeyResult.success) {
        return apiKeyResult;
      }

      const clerkOrgId = request.headers.get("x-org-id");
      if (!clerkOrgId) {
        log.warn("Missing X-Org-ID for API key auth", {
          requestId,
          orgId: apiKeyResult.auth.orgId,
        });
        return {
          success: false,
          error: { code: "BAD_REQUEST", message: "X-Org-ID header required" },
          status: 400,
        };
      }

      return {
        success: true,
        auth: {
          clerkOrgId,
          userId: apiKeyResult.auth.userId,
          authType: "api-key",
          apiKeyId: apiKeyResult.auth.apiKeyId,
        },
      };
    }

    // Clerk JWT bearer path (internal service-to-service)
    const clerkOrgId = request.headers.get("x-org-id");
    const userId = request.headers.get("x-user-id");

    if (!(clerkOrgId && userId)) {
      log.warn("Missing X-Org-ID or X-User-ID for bearer token", {
        requestId,
      });
      return {
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "X-Org-ID and X-User-ID headers required with bearer token",
        },
        status: 400,
      };
    }

    // Verify org membership
    const { getCachedUserOrgMemberships } = await import(
      "@repo/app-clerk-cache"
    );
    const userMemberships = await getCachedUserOrgMemberships(userId);
    const isMember = userMemberships.some(
      (m) => m.organizationId === clerkOrgId
    );

    if (!isMember) {
      log.warn("User not member of org", { requestId, userId, clerkOrgId });
      return {
        success: false,
        error: {
          code: "FORBIDDEN",
          message: "Access denied to this organization",
        },
        status: 403,
      };
    }

    log.info("Bearer token auth via headers", {
      requestId,
      userId,
      clerkOrgId,
    });
    return {
      success: true,
      auth: { clerkOrgId, userId, authType: "session" },
    };
  }

  // Session path — validate via Clerk
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

  const clerkOrgId = request.headers.get("x-org-id");
  if (!clerkOrgId) {
    log.warn("Missing X-Org-ID for session auth", { requestId, userId });
    return {
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "Org ID required. Provide 'X-Org-ID: <clerk-org-id>' header.",
      },
      status: 400,
    };
  }

  // Verify org membership
  const { getCachedUserOrgMemberships } = await import("@repo/app-clerk-cache");
  const userMemberships = await getCachedUserOrgMemberships(userId);
  const isMember = userMemberships.some((m) => m.organizationId === clerkOrgId);

  if (!isMember) {
    log.warn("User not member of org", { requestId, userId, clerkOrgId });
    return {
      success: false,
      error: {
        code: "FORBIDDEN",
        message: "Access denied to this organization",
      },
      status: 403,
    };
  }

  log.info("Session auth verified", { requestId, userId, clerkOrgId });
  return {
    success: true,
    auth: { clerkOrgId, userId, authType: "session" },
  };
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

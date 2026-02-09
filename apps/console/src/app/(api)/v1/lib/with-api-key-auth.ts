/**
 * API Key Authentication Middleware for v1 Routes
 *
 * SECURITY: Validates workspace-scoped API keys.
 * Keys are bound to specific workspaces - no more trusting X-Workspace-ID headers.
 */

import type { NextRequest } from "next/server";
import { db } from "@db/console/client";
import { orgApiKeys } from "@db/console/schema";
import { eq, and, sql } from "drizzle-orm";
import { hashApiKey, isValidApiKeyFormat } from "@repo/console-api-key";
import { log } from "@vendor/observability/log";

export interface ApiKeyAuthContext {
  workspaceId: string;
  userId: string; // createdByUserId for audit
  apiKeyId: string; // publicId
  clerkOrgId: string;
}

export interface AuthSuccess {
  success: true;
  auth: ApiKeyAuthContext;
}

export interface AuthError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  status: number;
}

export type AuthResult = AuthSuccess | AuthError;

/**
 * Verify workspace-scoped API key
 *
 * Required headers:
 * - Authorization: Bearer <api-key>
 *
 * The workspace is determined by the key binding, NOT by X-Workspace-ID header.
 * This prevents unauthorized access to other workspaces.
 *
 * @returns AuthResult with workspace context from the key binding
 */
export async function withApiKeyAuth(
  request: NextRequest,
  requestId?: string
): Promise<AuthResult> {
  // 1. Extract Authorization header
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    log.warn("Missing or invalid Authorization header", { requestId });
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "API key required. Provide 'Authorization: Bearer <api-key>' header.",
      },
      status: 401,
    };
  }

  const apiKey = authHeader.slice(7); // Remove "Bearer " prefix

  // 2. Validate key format (prefix and length)
  if (!isValidApiKeyFormat(apiKey)) {
    log.warn("Invalid API key format", { requestId });
    return {
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid API key format.",
      },
      status: 401,
    };
  }

  // 3. Hash and verify API key
  try {
    const keyHash = await hashApiKey(apiKey);

    const [foundKey] = await db
      .select({
        id: orgApiKeys.id,
        publicId: orgApiKeys.publicId,
        workspaceId: orgApiKeys.workspaceId,
        clerkOrgId: orgApiKeys.clerkOrgId,
        createdByUserId: orgApiKeys.createdByUserId,
        isActive: orgApiKeys.isActive,
        expiresAt: orgApiKeys.expiresAt,
      })
      .from(orgApiKeys)
      .where(and(eq(orgApiKeys.keyHash, keyHash), eq(orgApiKeys.isActive, true)))
      .limit(1);

    if (!foundKey) {
      log.warn("Invalid API key", { requestId });
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid API key",
        },
        status: 401,
      };
    }

    // 4. Check expiration
    if (foundKey.expiresAt && new Date(foundKey.expiresAt) < new Date()) {
      log.warn("Expired API key", { requestId, apiKeyId: foundKey.publicId });
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "API key expired",
        },
        status: 401,
      };
    }

    // 5. Get client IP for tracking
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    // 6. Update last used timestamp and IP (non-blocking)
    void db
      .update(orgApiKeys)
      .set({
        lastUsedAt: sql`CURRENT_TIMESTAMP`,
        lastUsedFromIp: clientIp.substring(0, 45),
      })
      .where(eq(orgApiKeys.id, foundKey.id))
      .catch((err: unknown) => {
        log.error("Failed to update API key lastUsedAt", {
          error: err instanceof Error ? err.message : String(err),
          apiKeyId: foundKey.publicId,
        });
      });

    // 7. Log warning if X-Workspace-ID header doesn't match (for migration awareness)
    const headerWorkspaceId = request.headers.get("x-workspace-id");
    if (headerWorkspaceId && headerWorkspaceId !== foundKey.workspaceId) {
      log.warn("X-Workspace-ID header does not match key binding - header ignored", {
        requestId,
        headerWorkspaceId,
        keyWorkspaceId: foundKey.workspaceId,
        apiKeyId: foundKey.publicId,
      });
    }

    log.info("API key verified", {
      requestId,
      apiKeyId: foundKey.publicId,
      workspaceId: foundKey.workspaceId,
    });

    return {
      success: true,
      auth: {
        workspaceId: foundKey.workspaceId, // From key binding, NOT header!
        userId: foundKey.createdByUserId,
        apiKeyId: foundKey.publicId,
        clerkOrgId: foundKey.clerkOrgId,
      },
    };
  } catch (error) {
    log.error("API key verification failed", { requestId, error });
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Authentication failed",
      },
      status: 500,
    };
  }
}

/**
 * Helper to create error response from AuthError
 */
export function createAuthErrorResponse(result: AuthError, requestId: string): Response {
  return Response.json(
    {
      error: result.error.code,
      message: result.error.message,
      requestId,
    },
    { status: result.status }
  );
}

/**
 * API Key Authentication Middleware for v1 Routes
 *
 * Adapts the tRPC apiKeyProcedure pattern for Next.js route handlers.
 * Extracts and verifies API keys from request headers.
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@db/console/client";
import { userApiKeys } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { hashApiKey } from "@repo/console-api-key";
import { log } from "@vendor/observability/log";

export interface ApiKeyAuthContext {
  workspaceId: string;
  userId: string;
  apiKeyId: string;
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
 * Verify API key and extract workspace context
 *
 * Required headers:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * @returns AuthResult with either auth context or error details
 *
 * @example
 * ```typescript
 * const result = await withApiKeyAuth(request);
 * if (!result.success) {
 *   return NextResponse.json(result.error, { status: result.status });
 * }
 * const { workspaceId, userId, apiKeyId } = result.auth;
 * ```
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

  // 2. Extract X-Workspace-ID header
  const workspaceId = request.headers.get("x-workspace-id");
  if (!workspaceId) {
    log.warn("Missing X-Workspace-ID header", { requestId });
    return {
      success: false,
      error: {
        code: "BAD_REQUEST",
        message: "Workspace ID required. Provide 'X-Workspace-ID: <workspace-id>' header.",
      },
      status: 400,
    };
  }

  // 3. Hash and verify API key
  try {
    const keyHash = await hashApiKey(apiKey);

    const [foundKey] = await db
      .select({
        id: userApiKeys.id,
        userId: userApiKeys.userId,
        isActive: userApiKeys.isActive,
        expiresAt: userApiKeys.expiresAt,
      })
      .from(userApiKeys)
      .where(and(eq(userApiKeys.keyHash, keyHash), eq(userApiKeys.isActive, true)))
      .limit(1);

    if (!foundKey) {
      log.warn("Invalid API key", { requestId, workspaceId });
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
      log.warn("Expired API key", { requestId, apiKeyId: foundKey.id });
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "API key expired",
        },
        status: 401,
      };
    }

    // 5. Update last used timestamp (non-blocking)
    void db
      .update(userApiKeys)
      .set({ lastUsedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(userApiKeys.id, foundKey.id))
      .catch((err: unknown) => {
        log.error("Failed to update API key lastUsedAt", {
          error: err instanceof Error ? err.message : String(err),
          apiKeyId: foundKey.id,
        });
      });

    log.info("API key verified", {
      requestId,
      apiKeyId: foundKey.id,
      userId: foundKey.userId,
      workspaceId,
    });

    return {
      success: true,
      auth: {
        workspaceId,
        userId: foundKey.userId,
        apiKeyId: foundKey.id,
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
export function createAuthErrorResponse(result: AuthError, requestId: string): NextResponse {
  return NextResponse.json(
    {
      error: result.error.code,
      message: result.error.message,
      requestId,
    },
    { status: result.status }
  );
}

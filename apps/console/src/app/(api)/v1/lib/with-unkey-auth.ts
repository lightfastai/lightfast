/**
 * Unkey API Key Authentication Middleware for v1 Routes
 *
 * SECURITY: Validates workspace-scoped API keys via Unkey's edge verification.
 * Keys are created through Unkey with sk_lf_ prefix and verified via Unkey's RPC.
 */

import { type NextRequest } from "next/server";
import { unkey } from "@vendor/unkey";

/**
 * API key prefix for Unkey-managed keys.
 * Unkey produces keys in the format: {prefix}_{random}
 * With prefix "sk_lf", the full key looks like: sk_lf_xxxxxxxxxxxx
 */
export const UNKEY_API_KEY_PREFIX = "sk_lf_";

export interface UnkeyAuthContext {
  workspaceId: string;
  userId: string;
  apiKeyId: string; // Unkey's keyId (key_xxx)
  clerkOrgId: string;
  ratelimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

export interface UnkeyAuthSuccess {
  success: true;
  auth: UnkeyAuthContext;
}

export interface UnkeyAuthError {
  success: false;
  error: { code: string; message: string };
  status: number;
}

export type UnkeyAuthResult = UnkeyAuthSuccess | UnkeyAuthError;

/**
 * Verify a workspace-scoped API key via Unkey's edge verification.
 *
 * Required headers:
 * - Authorization: Bearer <api-key>
 *
 * Workspace context is retrieved from the key's metadata stored in Unkey.
 * No DB lookup is performed — Unkey is the auth source of truth.
 */
export async function withUnkeyAuth(
  request: NextRequest,
  requestId?: string,
): Promise<UnkeyAuthResult> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid authorization header",
        },
        status: 401,
      };
    }

    const apiKey = authHeader.slice(7);

    // v2 SDK: verifyKey throws on HTTP errors, returns response data on success
    const response = await unkey.keys.verifyKey({ key: apiKey });

    const result = response.data;

    if (!result.valid) {
      const codeMap: Record<string, { message: string; status: number }> = {
        NOT_FOUND: { message: "Invalid API key", status: 401 },
        EXPIRED: { message: "API key expired", status: 401 },
        DISABLED: { message: "API key revoked", status: 401 },
        RATE_LIMITED: { message: "Rate limit exceeded", status: 429 },
        RATE_LIMITED_KEY: { message: "Rate limit exceeded", status: 429 },
        USAGE_EXCEEDED: { message: "Usage limit exceeded", status: 429 },
        FORBIDDEN: { message: "API key forbidden", status: 403 },
        INSUFFICIENT_PERMISSIONS: {
          message: "Insufficient permissions",
          status: 403,
        },
      };
      const mapped = codeMap[result.code ?? ""] ?? {
        message: "Invalid API key",
        status: 401,
      };
      return {
        success: false,
        error: { code: result.code ?? "UNAUTHORIZED", message: mapped.message },
        status: mapped.status,
      };
    }

    // Extract workspace context from Unkey metadata
    const meta = result.meta as
      | { workspaceId?: string; clerkOrgId?: string; createdBy?: string }
      | undefined;
    const workspaceId = meta?.workspaceId;
    const clerkOrgId = meta?.clerkOrgId;
    const userId = meta?.createdBy;

    if (!workspaceId || !clerkOrgId || !userId) {
      console.error(
        `[${requestId}] Unkey key ${result.keyId} missing required metadata:`,
        { workspaceId, clerkOrgId, userId },
      );
      return {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "API key metadata incomplete",
        },
        status: 500,
      };
    }

    // Extract the first ratelimit entry if available (our keys have one named ratelimit)
    const firstRatelimit = result.ratelimits?.[0];

    return {
      success: true,
      auth: {
        workspaceId,
        userId,
        apiKeyId: result.keyId ?? "",
        clerkOrgId,
        ratelimit: firstRatelimit
          ? {
              limit: firstRatelimit.limit,
              remaining: firstRatelimit.remaining,
              reset: firstRatelimit.reset,
            }
          : undefined,
      },
    };
  } catch (err) {
    console.error(`[${requestId}] Unkey auth error:`, err);
    return {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal authentication error",
      },
      status: 500,
    };
  }
}

import { ORPCError, os } from "@orpc/server";
import { LIGHTFAST_API_KEY_PREFIX } from "@repo/app-api-key";
import { auth } from "@vendor/clerk/server";
import { enrichContext } from "@vendor/observability/context";
import { log } from "@vendor/observability/log/next";
import { createORPCObservabilityMiddleware } from "@vendor/observability/orpc";
import type { NextRequest } from "next/server";
import { withApiKeyAuth } from "./with-api-key-auth";

export interface InitialContext {
  headers: Headers;
  requestId: string;
}

export interface AuthContext {
  apiKeyId: string | undefined;
  authType: "api-key" | "session";
  clerkOrgId: string;
  userId: string;
}

const base = os.$context<InitialContext>();

async function resolveAuth(
  headers: Headers,
  requestId: string
): Promise<AuthContext> {
  const authHeader = headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    if (token.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
      const apiKeyResult = await withApiKeyAuth(
        { headers } as NextRequest,
        requestId
      );

      if (!apiKeyResult.success) {
        throw new ORPCError("UNAUTHORIZED", {
          message: apiKeyResult.error.message,
        });
      }

      return {
        clerkOrgId: apiKeyResult.auth.orgId,
        userId: apiKeyResult.auth.userId,
        authType: "api-key",
        apiKeyId: apiKeyResult.auth.apiKeyId,
      };
    }

    throw new ORPCError("UNAUTHORIZED", {
      message:
        "Invalid bearer token. Use an API key (sk-lf-...) or sign in via session.",
    });
  }

  // Session path — validate via Clerk
  const { userId } = await auth();

  if (!userId) {
    throw new ORPCError("UNAUTHORIZED", {
      message:
        "Authentication required. Provide 'Authorization: Bearer <api-key>' header or sign in.",
    });
  }

  const clerkOrgId = headers.get("x-org-id");
  if (!clerkOrgId) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Org ID required. Provide 'X-Org-ID: <clerk-org-id>' header.",
    });
  }

  const { getUserOrgMemberships } = await import("@vendor/clerk/server");
  const userMemberships = await getUserOrgMemberships(userId);
  const isMember = userMemberships.some((m) => m.organizationId === clerkOrgId);

  if (!isMember) {
    log.warn("User not member of org", { requestId, userId, clerkOrgId });
    throw new ORPCError("FORBIDDEN", {
      message: "Access denied to this organization",
    });
  }

  log.info("Session auth verified", { requestId, userId, clerkOrgId });
  return {
    clerkOrgId,
    userId,
    authType: "session",
    apiKeyId: undefined,
  };
}

export const observabilityMiddleware = base.middleware(
  createORPCObservabilityMiddleware()
);

export const authMiddleware = base.middleware(async ({ context, next }) => {
  const authContext = await resolveAuth(context.headers, context.requestId);
  enrichContext({
    userId: authContext.userId,
    clerkOrgId: authContext.clerkOrgId,
    authType: authContext.authType,
    ...(authContext.apiKeyId && { apiKeyId: authContext.apiKeyId }),
  });
  return next({ context: authContext });
});

export const authed = base.use(authMiddleware);

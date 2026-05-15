import { ORPCError, os } from "@orpc/server";
import { clerkClient } from "@vendor/clerk/server";
import { enrichContext } from "@vendor/observability/context";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";

import type { AuthContext, InitialContext } from "../context";

const base = os.$context<InitialContext>();

async function resolveApiKey(
  headers: Headers,
  requestId: string
): Promise<AuthContext> {
  const authHeader = headers.get("authorization");
  const [scheme, token] = authHeader?.trim().split(/\s+/, 2) ?? [];
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    throw new ORPCError("UNAUTHORIZED", {
      message:
        "API key required. Provide 'Authorization: Bearer <api-key>' header.",
    });
  }

  // Every Clerk API key starts with `ak_`. Reject other shapes (session
  // JWTs, legacy custom tokens) without a network round-trip.
  if (!token.startsWith("ak_")) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid API key format.",
    });
  }

  let key;
  try {
    const clerk = await clerkClient();
    key = await clerk.apiKeys.verify(token);
  } catch (err) {
    log.warn("API key verification failed", {
      requestId,
      error: parseError(err),
    });
    throw new ORPCError("UNAUTHORIZED", { message: "Invalid API key" });
  }

  if (key.revoked) {
    throw new ORPCError("UNAUTHORIZED", { message: "API key revoked" });
  }
  if (key.expired) {
    throw new ORPCError("UNAUTHORIZED", { message: "API key expired" });
  }
  if (!key.subject.startsWith("org_")) {
    throw new ORPCError("FORBIDDEN", {
      message: "API key is not org-scoped",
    });
  }
  if (!key.createdBy) {
    throw new ORPCError("FORBIDDEN", {
      message: "API key is missing creator metadata",
    });
  }

  log.info("API key verified", {
    requestId,
    apiKeyId: key.id,
    orgId: key.subject,
  });

  return {
    apiKeyId: key.id,
    clerkOrgId: key.subject,
    userId: key.createdBy,
  };
}

export const authMiddleware = base.middleware(async ({ context, next }) => {
  const auth = await resolveApiKey(context.headers, context.requestId);
  enrichContext({
    userId: auth.userId,
    clerkOrgId: auth.clerkOrgId,
    authType: "api-key",
    apiKeyId: auth.apiKeyId,
  });
  return next({ context: auth });
});

import { db } from "@db/app/client";
import { orgApiKeys } from "@db/app/schema";
import { ORPCError, os } from "@orpc/server";
import { hashApiKey, isValidApiKeyFormat } from "@repo/app-api-key";
import { enrichContext } from "@vendor/observability/context";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";
import { and, eq, sql } from "drizzle-orm";

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

  const apiKey = token;

  if (!isValidApiKeyFormat(apiKey)) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "Invalid API key format.",
    });
  }

  const keyHash = hashApiKey(apiKey);

  const [foundKey] = await db
    .select({
      id: orgApiKeys.id,
      publicId: orgApiKeys.publicId,
      clerkOrgId: orgApiKeys.clerkOrgId,
      createdByUserId: orgApiKeys.createdByUserId,
      expiresAt: orgApiKeys.expiresAt,
    })
    .from(orgApiKeys)
    .where(and(eq(orgApiKeys.keyHash, keyHash), eq(orgApiKeys.isActive, true)))
    .limit(1);

  if (!foundKey) {
    throw new ORPCError("UNAUTHORIZED", { message: "Invalid API key" });
  }

  if (foundKey.expiresAt && new Date(foundKey.expiresAt) < new Date()) {
    throw new ORPCError("UNAUTHORIZED", { message: "API key expired" });
  }

  const clientIp =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown";

  void db
    .update(orgApiKeys)
    .set({
      lastUsedAt: sql`CURRENT_TIMESTAMP`,
      lastUsedFromIp: clientIp.slice(0, 45),
    })
    .where(eq(orgApiKeys.id, foundKey.id))
    .catch((err: unknown) => {
      log.error("Failed to update API key lastUsedAt", {
        error: parseError(err),
        apiKeyId: foundKey.publicId,
      });
    });

  log.info("API key verified", {
    requestId,
    apiKeyId: foundKey.publicId,
    orgId: foundKey.clerkOrgId,
  });

  return {
    apiKeyId: foundKey.publicId,
    clerkOrgId: foundKey.clerkOrgId,
    userId: foundKey.createdByUserId,
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

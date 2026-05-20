import { ORPCError, os } from "@orpc/server";
import { enrichContext } from "@vendor/observability/context";
import { parseError } from "@vendor/observability/error/next";
import { log } from "@vendor/observability/log/next";

import { isApiKeyAuthError, resolveApiKeyAuth } from "../../auth/api-key";
import type { AuthContext, InitialContext } from "../context";

const base = os.$context<InitialContext>();

async function resolveApiKey(
  headers: Headers,
  requestId: string
): Promise<AuthContext> {
  try {
    const result = await resolveApiKeyAuth({ headers });
    log.info("API key verified", {
      requestId,
      apiKeyId: result.apiKeyId,
      orgId: result.identity.orgId,
    });
    return {
      apiKeyId: result.apiKeyId,
      auth: { identity: result.identity },
    };
  } catch (err) {
    if (isApiKeyAuthError(err)) {
      if (err.reason === "invalid") {
        log.warn("API key verification failed", {
          requestId,
          error: parseError(err),
        });
      }
      throw new ORPCError(err.orpcCode, {
        data: { diagnostics: [err.diagnostic] },
        message: err.message,
      });
    }
    throw err;
  }
}

export const authMiddleware = base.middleware(async ({ context, next }) => {
  const auth = await resolveApiKey(context.headers, context.requestId);
  enrichContext({
    userId: auth.auth.identity.userId,
    clerkOrgId: auth.auth.identity.orgId,
    authType: "api-key",
    apiKeyId: auth.apiKeyId,
  });
  return next({ context: auth });
});

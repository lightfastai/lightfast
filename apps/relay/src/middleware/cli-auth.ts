import { createMiddleware } from "hono/factory";
import { hashApiKey, isValidApiKeyFormat } from "@repo/console-api-key";
import { db } from "@db/console/client";
import { orgApiKeys } from "@db/console/schema";
import { eq, and, isNull, or, gt } from "@vendor/db";

export const cliApiKeyAuth = createMiddleware<{
  Variables: { cliOrgId: string };
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing Authorization header" }, 401);
  }

  const apiKey = authHeader.replace("Bearer ", "");
  if (!isValidApiKeyFormat(apiKey)) {
    return c.json({ error: "Invalid API key format" }, 401);
  }

  const keyHash = await hashApiKey(apiKey);
  const [result] = await db
    .select({ orgId: orgApiKeys.clerkOrgId })
    .from(orgApiKeys)
    .where(
      and(
        eq(orgApiKeys.keyHash, keyHash),
        eq(orgApiKeys.isActive, true),
        or(isNull(orgApiKeys.expiresAt), gt(orgApiKeys.expiresAt, new Date().toISOString()))
      )
    )
    .limit(1);

  if (!result) {
    return c.json({ error: "Invalid or expired API key" }, 401);
  }

  c.set("cliOrgId", result.orgId);
  await next();
});

import { Hono } from "hono";
import { nanoid } from "@repo/lib";
import type { TenantVariables } from "../../middleware/tenant";
import { tenantMiddleware } from "../../middleware/tenant";
import { oauthStateKey } from "../../lib/keys";
import { redis } from "../../lib/redis";
import { getProvider } from "../../providers";
import { getStrategy } from "../../strategies/registry";
import type { ProviderName } from "../../providers/types";

const oauth = new Hono<{ Variables: TenantVariables }>();

/**
 * GET /connections/:provider/authorize
 *
 * Initiate OAuth flow. Generates state token, stores in Redis, returns
 * authorization URL for the provider.
 */
oauth.get("/:provider/authorize", tenantMiddleware, async (c) => {
  const providerName = c.req.param("provider") as ProviderName;
  const orgId = c.get("orgId");

  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  if (!orgId) {
    return c.json({ error: "missing_org_id" }, 400);
  }

  const state = nanoid();
  const connectedBy = c.req.header("X-User-Id") ?? "unknown";

  // Store OAuth state in Redis (10-minute TTL)
  await redis.hset(oauthStateKey(state), {
    provider: provider.name,
    orgId,
    connectedBy,
    createdAt: Date.now().toString(),
  });
  await redis.expire(oauthStateKey(state), 600);

  const url = provider.getAuthorizationUrl(state);

  return c.json({ url, state });
});

/**
 * Validate and consume OAuth state from Redis.
 * Returns stateData if valid, null if missing or expired.
 */
async function resolveAndConsumeState(
  c: { req: { query(key: string): string | undefined } },
): Promise<Record<string, string> | null> {
  const state = c.req.query("state");
  if (!state) return null;

  const stateData = await redis.hgetall<Record<string, string>>(oauthStateKey(state));
  if (!stateData?.orgId) return null;

  await redis.del(oauthStateKey(state));
  return stateData;
}

/**
 * GET /connections/:provider/callback
 *
 * OAuth callback. Validates state, dispatches to provider strategy.
 */
oauth.get("/:provider/callback", async (c) => {
  const providerName = c.req.param("provider") as ProviderName;

  let provider;
  try {
    provider = getProvider(providerName);
  } catch {
    return c.json({ error: "unknown_provider", provider: providerName }, 400);
  }

  const stateData = await resolveAndConsumeState(c);
  if (!stateData) {
    return c.json({ error: "invalid_or_expired_state" }, 400);
  }

  // For standard OAuth providers, validate provider matches state
  if (provider.name !== "github" && stateData.provider !== provider.name) {
    return c.json({ error: "invalid_or_expired_state" }, 400);
  }

  const strategy = getStrategy(providerName);

  try {
    const result = await strategy.handleCallback(c, provider, stateData);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    if (message === "missing code" || message === "missing installation_id") {
      return c.json({ error: "missing_params", message }, 400);
    }
    if (message === "insert_failed") {
      return c.json({ error: "insert_failed" }, 500);
    }
    return c.json({ error: "callback_failed", message }, 502);
  }
});

export { oauth };

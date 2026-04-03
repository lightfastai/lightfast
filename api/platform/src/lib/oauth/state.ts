/**
 * Redis atomic state management for OAuth flows.
 *
 * Ported from apps/gateway/src/routes/connections.ts (lines 113-168, 180-196).
 * Functions return data structures — no HTTP responses.
 */
import { redis } from "@vendor/upstash";
import { oauthResultKey, oauthStateKey } from "../cache";

// ── Store OAuth State ──

interface OAuthStateData {
  connectedBy: string;
  createdAt: string;
  orgId: string;
  provider: string;
  redirectTo?: string;
}

/**
 * Store OAuth state in Redis with a 10-minute TTL.
 * Uses an atomic pipeline (HSET + EXPIRE) to prevent partial writes.
 */
export async function storeOAuthState(
  state: string,
  data: OAuthStateData
): Promise<void> {
  const key = oauthStateKey(state);
  await redis
    .pipeline()
    .hset(key, {
      provider: data.provider,
      orgId: data.orgId,
      connectedBy: data.connectedBy,
      ...(data.redirectTo ? { redirectTo: data.redirectTo } : {}),
      createdAt: data.createdAt,
    })
    .expire(key, 600)
    .exec();
}

// ── Get OAuth Result ──

/**
 * Poll for OAuth completion. Returns the result hash if present, null if pending.
 * Used by CLI to detect when the browser OAuth flow has completed.
 */
export async function getOAuthResult(
  state: string
): Promise<Record<string, string> | null> {
  return redis.hgetall<Record<string, string>>(oauthResultKey(state));
}

/**
 * Redis atomic state management for OAuth flows.
 *
 * Ported from apps/gateway/src/routes/connections.ts (lines 113-168, 180-196).
 * Functions return data structures — no HTTP responses.
 */
import { log } from "@vendor/observability/log/next";
import { redis } from "@vendor/upstash";
import { oauthResultKey, oauthStateKey } from "../cache";

// ── Store OAuth State ──

export interface OAuthStateData {
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

  log.info("[oauth/state] state stored", {
    provider: data.provider,
    orgId: data.orgId,
    statePrefix: state.slice(0, 8),
  });
}

// ── Consume OAuth State ──

/**
 * Atomic read-and-delete to prevent state replay via concurrent requests.
 * Returns stateData if valid, null if missing or expired.
 */
export async function consumeOAuthState(
  state: string
): Promise<Record<string, string> | null> {
  const key = oauthStateKey(state);
  const [stateData] = await redis
    .multi()
    .hgetall<Record<string, string>>(key)
    .del(key)
    .exec<[Record<string, string> | null, number]>();

  if (!stateData?.orgId) {
    log.warn("[oauth/state] state not found or expired", {
      statePrefix: state.slice(0, 8),
    });
    return null;
  }

  log.info("[oauth/state] state consumed", {
    statePrefix: state.slice(0, 8),
    orgId: stateData.orgId,
  });

  return stateData;
}

// ── Store OAuth Result ──

export interface OAuthResultData {
  error?: string;
  provider?: string;
  reactivated?: string;
  setupAction?: string;
  status: "completed" | "failed";
}

/**
 * Store OAuth completion/failure result in Redis for CLI polling (5-min TTL).
 */
export async function storeOAuthResult(
  state: string,
  data: OAuthResultData
): Promise<void> {
  const key = oauthResultKey(state);
  const fields: Record<string, string> = { status: data.status };

  if (data.provider) {
    fields.provider = data.provider;
  }
  if (data.reactivated) {
    fields.reactivated = data.reactivated;
  }
  if (data.setupAction) {
    fields.setupAction = data.setupAction;
  }
  if (data.error) {
    fields.error = data.error;
  }

  await redis.pipeline().hset(key, fields).expire(key, 300).exec();
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

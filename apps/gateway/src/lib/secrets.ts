import { env } from "../env";
import type { SourceType } from "../providers/types";
import { connectionKey } from "./keys";
import { redis } from "./redis";

/**
 * Resolve the webhook signing secret for a provider.
 *
 * GitHub and Vercel use global secrets from env vars.
 * Linear uses a global signing secret (per-connection secrets can be added later).
 * Sentry uses a per-integration client secret.
 */
export function getWebhookSecret(
  provider: SourceType,
  _connectionId?: string,
): Promise<string> {
  switch (provider) {
    case "github":
      return Promise.resolve(env.GITHUB_WEBHOOK_SECRET);
    case "vercel":
      return Promise.resolve(env.VERCEL_CLIENT_INTEGRATION_SECRET);
    case "linear":
      return Promise.resolve(env.LINEAR_WEBHOOK_SIGNING_SECRET);
    case "sentry":
      return Promise.resolve(env.SENTRY_CLIENT_SECRET);
    default: {
      const _exhaustive: never = provider;
      throw new Error(
        `No webhook secret configured for provider: ${String(_exhaustive)}`,
      );
    }
  }
}

/**
 * Get per-connection webhook secret from Redis.
 * Used for providers that support per-connection webhook secrets (Linear).
 */
export async function getConnectionWebhookSecret(
  connectionId: string,
): Promise<string | null> {
  const conn = await redis.hgetall<{ webhookSecret?: string }>(
    connectionKey(connectionId),
  );
  return conn?.webhookSecret ?? null;
}

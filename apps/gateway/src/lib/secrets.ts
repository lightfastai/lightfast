import { eq } from "drizzle-orm";
import { gwInstallations } from "@db/console/schema";
import { env } from "../env";
import type { ProviderName } from "../providers/types";
import { db } from "./db";

/**
 * Resolve the webhook signing secret for a provider.
 *
 * GitHub and Vercel use global secrets from env vars.
 * Linear uses a global signing secret (per-connection secrets can be added later).
 * Sentry uses a per-integration client secret.
 */
export function getWebhookSecret(
  provider: ProviderName,
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
  }
}

/**
 * Get per-connection webhook secret from PlanetScale.
 * Used for providers that support per-connection webhook secrets (Linear, Sentry).
 */
export async function getConnectionWebhookSecret(
  installationId: string,
): Promise<string | null> {
  const rows = await db
    .select({ webhookSecret: gwInstallations.webhookSecret })
    .from(gwInstallations)
    .where(eq(gwInstallations.id, installationId))
    .limit(1);

  return rows[0]?.webhookSecret ?? null;
}

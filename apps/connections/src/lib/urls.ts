import { withRelatedProject } from "@vercel/related-projects";
import { getQStashClient } from "@vendor/qstash";
import { env } from "../env";

/**
 * Connections service base URL (self).
 */
export const connectionsBaseUrl = (() => {
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return "http://localhost:4110";
})();

const isDevelopment =
  env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";

/**
 * Gateway base URL — used for webhook registration callbacks.
 * Linear webhook callbacks must point at the gateway, not the connections service.
 */
export const gatewayBaseUrl = withRelatedProject({
  projectName: "lightfast-gateway",
  defaultHost: isDevelopment
    ? "http://localhost:4108"
    : "https://gateway.lightfast.ai",
});

// Get the console URL dynamically based on environment
export const consoleUrl = withRelatedProject({
  projectName: "lightfast-console",
  defaultHost: isDevelopment
    ? "http://localhost:4107"
    : "https://lightfast.ai",
});

// Get the backfill service URL dynamically based on environment
export const backfillUrl = withRelatedProject({
  projectName: "lightfast-backfill",
  defaultHost: isDevelopment
    ? "http://localhost:4109"
    : "https://backfill.lightfast.ai",
});

const qstash = getQStashClient();

/**
 * Notify the backfill service to start a historical backfill for a new connection.
 * Best-effort — errors are logged but do not block the OAuth callback response.
 */
export async function notifyBackfillService(params: {
  installationId: string;
  provider: string;
  orgId: string;
}): Promise<void> {
  try {
    await qstash.publishJSON({
      url: `${backfillUrl}/trigger`,
      headers: { "X-API-Key": env.GATEWAY_API_KEY },
      body: params,
      retries: 3,
    });
  } catch (err) {
    console.error("[connections] Failed to notify backfill service:", err);
  }
}

/**
 * Cancel any running backfill for a connection.
 * Called during connection teardown to stop wasting steps on revoked connections.
 * Best-effort — errors are logged but do not block teardown.
 */
export async function cancelBackfillService(params: {
  installationId: string;
}): Promise<void> {
  try {
    await qstash.publishJSON({
      url: `${backfillUrl}/trigger/cancel`,
      headers: { "X-API-Key": env.GATEWAY_API_KEY },
      body: params,
      retries: 3,
    });
  } catch (err) {
    console.error("[connection-teardown] Failed to cancel backfill:", err);
  }
}

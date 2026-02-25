import { withRelatedProject } from "@vercel/related-projects";
import { getQStashClient } from "@vendor/qstash";
import { env } from "../env";

/**
 * Gateway base URL derived from Vercel system environment variables.
 *
 * - Production: https://{VERCEL_PROJECT_PRODUCTION_URL} (gateway.lightfast.ai)
 * - Preview:    https://{VERCEL_URL} (deployment-specific)
 * - Local:      http://localhost:4108
 */
export const gatewayBaseUrl = (() => {
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}`;
  }

  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return "http://localhost:4108";
})();

const isDevelopment =
  env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";

// Get the console URL dynamically based on environment
// Console is served from lightfast.ai via microfrontends (not a separate subdomain)
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

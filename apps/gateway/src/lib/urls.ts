import { backfillUrl as _backfillUrl } from "@repo/gateway-service-clients";
import { getQStashClient } from "@vendor/qstash";
import { withRelatedProject } from "@vercel/related-projects";
import { env } from "../env.js";

export { backfillUrl } from "@repo/gateway-service-clients";

/**
 * Gateway service base URL (self).
 */
export const gatewayBaseUrl = (() => {
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) {
    return `https://${env.VERCEL_URL}/services`;
  }

  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/services`;
  }

  return "http://localhost:3024/services";
})();

const isDevelopment =
  env.VERCEL_ENV !== "production" && env.VERCEL_ENV !== "preview";

/**
 * Relay base URL — used for webhook registration callbacks.
 * Linear webhook callbacks must point at the relay, not the gateway service.
 */
export const relayBaseUrl = `${withRelatedProject({
  projectName: "lightfast-relay",
  defaultHost: isDevelopment
    ? "http://localhost:4108"
    : "https://relay.lightfast.ai",
})}/api`;

// Get the console URL dynamically based on environment
export const consoleUrl = withRelatedProject({
  projectName: "lightfast-console",
  defaultHost: isDevelopment ? "http://localhost:3024" : "https://lightfast.ai",
});

let _qstash: ReturnType<typeof getQStashClient> | undefined;
function getClient() {
  return (_qstash ??= getQStashClient());
}

/**
 * Cancel any running backfill for a connection.
 * Called during connection teardown to stop wasting steps on revoked connections.
 * Best-effort — errors are logged but do not block teardown.
 */
export async function cancelBackfillService(params: {
  installationId: string;
  correlationId?: string;
}): Promise<void> {
  try {
    await getClient().publishJSON({
      url: `${_backfillUrl}/trigger/cancel`,
      headers: {
        "X-API-Key": env.GATEWAY_API_KEY,
        ...(params.correlationId
          ? { "X-Correlation-Id": params.correlationId }
          : {}),
      },
      body: params,
      retries: 3,
      deduplicationId: `backfill-cancel:${params.installationId}`,
    });
  } catch (err) {
    console.error("[connection-teardown] Failed to cancel backfill", {
      installationId: params.installationId,
      backfillUrl: _backfillUrl,
      err,
    });
  }
}

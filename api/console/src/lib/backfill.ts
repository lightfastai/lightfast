import { withRelatedProject } from "@vendor/related-projects";
import { env } from "../env";

const isDevelopment =
  process.env.NEXT_PUBLIC_VERCEL_ENV !== "production" &&
  process.env.NEXT_PUBLIC_VERCEL_ENV !== "preview";

const relayUrl = withRelatedProject({
  projectName: "lightfast-relay",
  defaultHost: isDevelopment
    ? "http://localhost:4108"
    : "https://relay.lightfast.ai",
});

/**
 * Notify the relay to trigger a historical backfill for a connection.
 * Best-effort — errors are logged but never thrown.
 */
export async function notifyBackfill(params: {
  installationId: string;
  provider: string;
  orgId: string;
  correlationId?: string;
}): Promise<void> {
  const correlationId = params.correlationId ?? crypto.randomUUID();
  try {
    const res = await fetch(`${relayUrl}/api/backfill`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": env.GATEWAY_API_KEY,
        "X-Correlation-Id": correlationId,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error("[api/console] backfill trigger failed", {
        status: res.status,
        installationId: params.installationId,
        provider: params.provider,
      });
    }
  } catch (err) {
    console.error("[api/console] Failed to notify backfill", {
      installationId: params.installationId,
      provider: params.provider,
      err,
    });
  }
}

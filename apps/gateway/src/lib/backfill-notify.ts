import { qstash } from "./qstash";
import { backfillUrl } from "./related-projects";
import { env } from "../env";

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

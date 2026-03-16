import type {
  BackfillEstimatePayload,
  BackfillTriggerPayload,
} from "@repo/console-providers";

import type { ServiceClientConfig } from "./headers";
import { buildServiceHeaders } from "./headers";
import { backfillUrl } from "./urls";

/**
 * Create a typed HTTP client for the backfill service.
 * Used for direct calls to backfill (not via relay's QStash proxy).
 *
 * @example
 * const bf = createBackfillClient({ apiKey: env.GATEWAY_API_KEY });
 * const estimate = await bf.estimate({ installationId: "inst-1", provider: "github", orgId: "org-1", depth: 30 });
 */
export function createBackfillClient(config: ServiceClientConfig) {
  const h = buildServiceHeaders(config);

  return {
    /**
     * Probe the backfill service for a scope estimate.
     * Direct HTTP call — does not go through relay.
     */
    async estimate(
      payload: BackfillEstimatePayload
    ): Promise<Record<string, unknown>> {
      const response = await fetch(`${backfillUrl}/estimate`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      return response.json() as Promise<Record<string, unknown>>;
    },

    /**
     * Trigger a historical backfill directly on the backfill service.
     * Direct HTTP call — does not go through relay.
     */
    async trigger(
      payload: BackfillTriggerPayload
    ): Promise<{ status: string; installationId: string }> {
      const response = await fetch(`${backfillUrl}/trigger`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "unknown");
        throw new Error(
          `Backfill trigger failed: ${response.status} — ${text}`
        );
      }
      return response.json() as Promise<{
        status: string;
        installationId: string;
      }>;
    },
  };
}

export type BackfillClient = ReturnType<typeof createBackfillClient>;

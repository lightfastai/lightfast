import type { BackfillEstimatePayload } from "@repo/console-validation";

import type { ServiceClientConfig } from "./headers.js";
import { buildServiceHeaders } from "./headers.js";
import { backfillUrl } from "./urls.js";

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
    async estimate(payload: BackfillEstimatePayload): Promise<Record<string, unknown>> {
      const response = await fetch(`${backfillUrl}/estimate`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      return response.json() as Promise<Record<string, unknown>>;
    },
  };
}

export type BackfillClient = ReturnType<typeof createBackfillClient>;

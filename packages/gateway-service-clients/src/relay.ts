import type { BackfillTriggerPayload } from "@repo/console-validation";

import type { ServiceClientConfig } from "./headers.js";
import { buildServiceHeaders } from "./headers.js";
import { relayUrl } from "./urls.js";

export interface DispatchPayload {
  connectionId: string;
  orgId: string;
  deliveryId: string;
  eventType: string;
  payload: unknown;
  receivedAt: number;
}

/**
 * Create a typed HTTP client for the relay service.
 *
 * @example
 * const relay = createRelayClient({ apiKey: env.GATEWAY_API_KEY, requestSource: "backfill" });
 * await relay.dispatchWebhook("github", payload, true);
 */
export function createRelayClient(config: ServiceClientConfig) {
  const h = buildServiceHeaders(config);

  return {
    async dispatchWebhook(
      provider: string,
      payload: DispatchPayload,
      holdForReplay?: boolean,
    ): Promise<void> {
      const response = await fetch(`${relayUrl}/webhooks/${provider}`, {
        method: "POST",
        headers: {
          ...h,
          "Content-Type": "application/json",
          ...(holdForReplay ? { "X-Backfill-Hold": "true" } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "unknown");
        throw new Error(`Relay dispatchWebhook failed: ${response.status} — ${text}`);
      }
    },

    async replayCatchup(
      installationId: string,
      batchSize: number,
    ): Promise<{ remaining: number }> {
      const response = await fetch(`${relayUrl}/admin/replay/catchup`, {
        method: "POST",
        headers: { ...h, "Content-Type": "application/json" },
        body: JSON.stringify({ installationId, batchSize }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) {
        throw new Error(`Relay replayCatchup failed: ${response.status}`);
      }
      return response.json() as Promise<{ remaining: number }>;
    },

    /**
     * Trigger a historical backfill via relay's QStash dispatch.
     * Best-effort — errors are logged but not thrown.
     */
    async triggerBackfill(params: BackfillTriggerPayload & { correlationId?: string }): Promise<void> {
      const { correlationId: _cid, ...payload } = params;
      try {
        const response = await fetch(`${relayUrl}/backfill`, {
          method: "POST",
          headers: { ...h, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          console.error("[service-clients] backfill trigger failed", {
            status: response.status,
            installationId: params.installationId,
            provider: params.provider,
          });
        }
      } catch (err) {
        console.error("[service-clients] Failed to trigger backfill", {
          installationId: params.installationId,
          provider: params.provider,
          err,
        });
      }
    },
  };
}

export type RelayClient = ReturnType<typeof createRelayClient>;

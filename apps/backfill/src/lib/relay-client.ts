import { env } from "../env.js";
import { relayUrl } from "./related-projects.js";

export interface DispatchPayload {
  connectionId: string;
  orgId: string;
  deliveryId: string;
  eventType: string;
  payload: unknown;
  receivedAt: number;
}

function headers(correlationId?: string) {
  return {
    "X-API-Key": env.GATEWAY_API_KEY,
    ...(correlationId ? { "X-Correlation-Id": correlationId } : {}),
  };
}

export function createRelayClient(opts: { correlationId?: string } = {}) {
  const h = headers(opts.correlationId);

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
        throw new Error(`Relay ingestWebhook failed: ${response.status} — ${text}`);
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
  };
}

export type RelayClient = ReturnType<typeof createRelayClient>;

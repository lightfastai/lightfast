import type { BackfillTriggerPayload } from "@repo/gateway-types";
import { createRelayClient } from "@repo/gateway-service-clients";

import { env } from "../env";

/**
 * Notify the relay to trigger a historical backfill for a connection.
 * Best-effort — errors are logged but never thrown.
 */
export async function notifyBackfill(params: {
  installationId: string;
  provider: string;
  orgId: string;
  depth?: 7 | 30 | 90;
  entityTypes?: string[];
  holdForReplay?: boolean;
  correlationId?: string;
}): Promise<void> {
  // TODO: Remove when backfill is ready for production
  return;

  const relay = createRelayClient({
    apiKey: env.GATEWAY_API_KEY,
    correlationId: params.correlationId ?? crypto.randomUUID(),
  });

  await relay.triggerBackfill(params as BackfillTriggerPayload & { correlationId?: string });
}

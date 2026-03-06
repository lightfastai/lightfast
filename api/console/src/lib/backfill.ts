import type { BackfillTriggerPayload } from "@repo/console-validation";
import { createBackfillClient } from "@repo/gateway-service-clients";

import { env } from "../env.js";

/**
 * Notify the backfill service to trigger a historical backfill for a connection.
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
  const { correlationId: _cid, depth, entityTypes, holdForReplay, ...required } = params;
  const payload = {
    ...required,
    ...(depth !== undefined && { depth }),
    ...(entityTypes !== undefined && { entityTypes }),
    ...(holdForReplay !== undefined && { holdForReplay }),
  } as BackfillTriggerPayload;
  try {
    const client = createBackfillClient({ apiKey: env.GATEWAY_API_KEY });
    await client.trigger(payload);
  } catch (err) {
    console.error("[console] Failed to trigger backfill", {
      installationId: params.installationId,
      provider: params.provider,
      err,
    });
  }
}

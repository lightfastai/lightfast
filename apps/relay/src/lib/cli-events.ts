import { redis } from "@vendor/upstash";

export interface CLIWebhookEvent {
  provider: string;
  deliveryId: string;
  eventType: string;
  resourceId: string | null;
  receivedAt: number;
  payload: unknown;
}

/**
 * Publish a webhook event to the CLI event stream for an org.
 * Fire-and-forget — errors are logged but don't affect webhook processing.
 */
export async function publishCLIEvent(
  orgId: string,
  event: CLIWebhookEvent
): Promise<void> {
  try {
    const streamKey = `cli:events:${orgId}`;
    const pipeline = redis.pipeline();
    pipeline.xadd(streamKey, "*", { data: JSON.stringify(event) }, {
      trim: {
        type: "MAXLEN",
        threshold: 1000,
        comparison: "~",
      },
    });
    pipeline.expire(streamKey, 3600);
    await pipeline.exec();
  } catch (err) {
    console.error("[cli-events] Failed to publish:", err);
  }
}

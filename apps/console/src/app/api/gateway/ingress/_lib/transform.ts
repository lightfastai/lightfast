import type { WebhookEnvelope } from "@repo/console-types";
import type { PostTransformEvent } from "@repo/console-validation";
import { transformWebhookPayload } from "@repo/console-webhooks";

/**
 * Transform a webhook envelope into a PostTransformEvent.
 * Delegates to the centralized dispatch in @repo/console-webhooks.
 * Returns null for unsupported event types.
 */
export function transformEnvelope(
  envelope: WebhookEnvelope,
): PostTransformEvent | null {
  return transformWebhookPayload(
    envelope.provider,
    envelope.eventType,
    envelope.payload,
    {
      deliveryId: envelope.deliveryId,
      receivedAt: new Date(envelope.receivedAt),
      eventType: envelope.eventType,
    },
  );
}

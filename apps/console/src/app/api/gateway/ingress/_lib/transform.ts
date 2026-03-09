import type {
  PostTransformEvent,
  WebhookEnvelope,
} from "@repo/console-providers";
import { transformWebhookPayload } from "@repo/console-providers";

/**
 * Transform a webhook envelope into a PostTransformEvent.
 * Delegates to the centralized dispatch in @repo/console-providers.
 * Returns null for unsupported event types.
 */
export function transformEnvelope(
  envelope: WebhookEnvelope
): PostTransformEvent | null {
  return transformWebhookPayload(
    envelope.provider,
    envelope.eventType,
    envelope.payload,
    {
      deliveryId: envelope.deliveryId,
      receivedAt: new Date(envelope.receivedAt),
      eventType: envelope.eventType,
    }
  );
}

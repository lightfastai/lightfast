import { transformWebhookPayload } from "@repo/app-providers";
import type {
  PostTransformEvent,
  WebhookEnvelope,
} from "@repo/app-providers/contracts";

/**
 * Transform a webhook envelope into a PostTransformEvent.
 * Delegates to the centralized dispatch in @repo/app-providers.
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
      receivedAt: envelope.receivedAt,
    }
  );
}

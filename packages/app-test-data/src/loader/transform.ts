/**
 * Webhook Transformer Integration
 *
 * Routes raw webhook payloads through the production dispatch.
 */

import type { SourceType } from "@repo/app-providers";
import { transformWebhookPayload } from "@repo/app-providers";
import type { PostTransformEvent } from "@repo/app-providers/contracts";

export interface WebhookPayload {
  eventType: string;
  payload: unknown;
  source: SourceType;
}

/**
 * Generate a unique delivery ID for test webhooks
 */
const generateDeliveryId = (): string => {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * Transform a raw webhook payload to PostTransformEvent using the production dispatch.
 */
export function transformWebhook(
  webhook: WebhookPayload,
  index: number
): PostTransformEvent {
  const event = transformWebhookPayload(
    webhook.source,
    webhook.eventType,
    webhook.payload,
    {
      deliveryId: generateDeliveryId(),
      receivedAt: Date.now(),
    }
  );

  if (!event) {
    throw new Error(
      `Unsupported webhook event: ${webhook.source}:${webhook.eventType}`
    );
  }

  // Add test suffix to sourceId for uniqueness across runs
  event.sourceId = `${event.sourceId}:test:${index}`;

  // Mark as test data
  event.attributes = {
    ...event.attributes,
    testData: true,
  };

  return event;
}

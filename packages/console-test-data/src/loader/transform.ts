/**
 * Webhook Transformer Integration
 *
 * Routes raw webhook payloads through the production dispatch.
 */

import type { PostTransformEvent, SourceType } from "@repo/console-providers";
import { transformWebhookPayload } from "@repo/console-providers";

export interface WebhookPayload {
  source: SourceType;
  eventType: string;
  payload: unknown;
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
      receivedAt: new Date(),
      eventType: webhook.eventType,
    },
  );

  if (!event) {
    throw new Error(
      `Unsupported webhook event: ${webhook.source}:${webhook.eventType}`
    );
  }

  // Add test suffix to sourceId for uniqueness across runs
  event.sourceId = `${event.sourceId}:test:${index}`;

  // Mark as test data
  event.metadata = {
    ...event.metadata,
    testData: true,
  };

  return event;
}

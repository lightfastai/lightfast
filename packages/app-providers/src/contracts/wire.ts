import { z } from "zod";
import { providerSlugSchema } from "../client/display";

/**
 * Payload passed from the thin webhook route to the durable receipt workflow.
 * Contains all data extracted after signature verification and JSON parsing.
 */
export const webhookReceiptPayloadSchema = z.object({
  provider: providerSlugSchema,
  deliveryId: z.string(),
  eventType: z.string(),
  resourceId: z.string().nullable(),
  payload: z.unknown(),
  receivedAt: z.number(),
  /** Cross-service correlation ID for distributed tracing */
  correlationId: z.string().optional(),
});
export type WebhookReceiptPayload = z.infer<typeof webhookReceiptPayloadSchema>;

/**
 * Envelope sent from Relay to Console ingress via QStash.
 * This is the Relay->Console contract for webhook delivery.
 */
export const webhookEnvelopeSchema = z.object({
  /** Unique delivery ID for deduplication */
  deliveryId: z.string(),
  /** Gateway installation ID (gw_installations.id) */
  connectionId: z.string(),
  /** Clerk organization ID */
  orgId: z.string(),
  /** Provider name */
  provider: providerSlugSchema,
  /** Provider-specific event type */
  eventType: z.string(),
  /** Raw provider webhook payload */
  payload: z.unknown(),
  /** Unix timestamp in milliseconds when the webhook was received */
  receivedAt: z.number(),
  /** Cross-service correlation ID for distributed tracing */
  correlationId: z.string().optional(),
});
export type WebhookEnvelope = z.infer<typeof webhookEnvelopeSchema>;

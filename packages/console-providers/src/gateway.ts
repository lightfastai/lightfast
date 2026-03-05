/**
 * Gateway Service Contract Schemas
 *
 * Cross-service Zod schemas for relay, gateway, and console ingress.
 * These define the wire formats between services with runtime validation.
 */

import { z } from "zod";
import { sourceTypeSchema } from "./registry.js";

/**
 * Payload passed from the thin webhook route to the durable receipt workflow.
 * Contains all data extracted after signature verification and JSON parsing.
 */
export const webhookReceiptPayloadSchema = z.object({
  provider: sourceTypeSchema,
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
  provider: sourceTypeSchema,
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

/**
 * Gateway connection response shape.
 * Returned by GET /gateway/:id
 */
export const gatewayConnectionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  externalId: z.string(),
  orgId: z.string(),
  status: z.string(),
  resources: z.array(
    z.object({
      id: z.string(),
      providerResourceId: z.string(),
      resourceName: z.string().nullable(),
    }),
  ),
});
export type GatewayConnection = z.infer<typeof gatewayConnectionSchema>;

/**
 * Gateway token response shape.
 * Returned by GET /gateway/:id/token
 */
export const gatewayTokenResultSchema = z.object({
  accessToken: z.string(),
  provider: z.string(),
  expiresIn: z.number().nullable(),
});
export type GatewayTokenResult = z.infer<typeof gatewayTokenResultSchema>;

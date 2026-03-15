/**
 * Gateway Service Contract Schemas
 *
 * Cross-service Zod schemas for relay, gateway, and console ingress.
 * These define the wire formats between services with runtime validation.
 */

import { z } from "zod";
import { sourceTypeSchema } from "./registry";

/**
 * Service auth webhook body — sent by internal services (backfill) with X-API-Key.
 * Pre-resolved connectionId/orgId; skips HMAC/dedup/connection resolution.
 */
export const serviceAuthWebhookBodySchema = z.object({
  connectionId: z.string().min(1),
  orgId: z.string().min(1),
  deliveryId: z.string().min(1),
  eventType: z.string().min(1),
  resourceId: z.string().nullable().optional(),
  payload: z.unknown(),
  receivedAt: z.number().finite(),
});
export type ServiceAuthWebhookBody = z.infer<
  typeof serviceAuthWebhookBodySchema
>;

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
    })
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

// ── Backfill Depth (internal) ──

export const backfillDepthSchema = z.union([
  z.literal(1),
  z.literal(7),
  z.literal(30),
  z.literal(90),
]);

// ── Installation-level Backfill Config (gatewayInstallations.backfillConfig) ──

export const gwInstallationBackfillConfigSchema = z.object({
  depth: backfillDepthSchema,
  entityTypes: z.array(z.string()).min(1),
});
export type GwInstallationBackfillConfig = z.infer<
  typeof gwInstallationBackfillConfigSchema
>;

/** Ordered options for UI depth selectors. */
export const BACKFILL_DEPTH_OPTIONS = [
  1, 7, 30, 90,
] as const satisfies readonly z.infer<typeof backfillDepthSchema>[];

// ── Backfill Run Statuses (internal) ──

const backfillRunStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

/** Terminal statuses that set `completedAt` */
export const backfillTerminalStatusSchema = z.enum([
  "completed",
  "failed",
  "cancelled",
]);
export const BACKFILL_TERMINAL_STATUSES = backfillTerminalStatusSchema.options;

// ── Trigger payload (Console → Relay → Backfill) ──

export const backfillTriggerPayload = z.object({
  installationId: z.string().min(1),
  provider: sourceTypeSchema,
  orgId: z.string().min(1),
  depth: backfillDepthSchema.default(1),
  entityTypes: z.array(z.string()).optional(),
  holdForReplay: z.boolean().optional(),
  /** Cross-service correlation ID for distributed tracing */
  correlationId: z.string().optional(),
});
export type BackfillTriggerPayload = z.infer<typeof backfillTriggerPayload>;

// ── Estimate payload (Console → Backfill, omits holdForReplay) ──

export const backfillEstimatePayload = backfillTriggerPayload.omit({
  holdForReplay: true,
});
export type BackfillEstimatePayload = z.infer<typeof backfillEstimatePayload>;

// ── Proxy wire types ─────────────────────────────────────────────────────────

export const proxyExecuteRequestSchema = z.object({
  endpointId: z.string(),
  pathParams: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
});

export type ProxyExecuteRequest = z.infer<typeof proxyExecuteRequestSchema>;

export const proxyExecuteResponseSchema = z.object({
  status: z.number(),
  data: z.unknown(),
  headers: z.record(z.string(), z.string()),
});

export type ProxyExecuteResponse = z.infer<typeof proxyExecuteResponseSchema>;

export const proxyEndpointsResponseSchema = z.object({
  provider: z.string(),
  baseUrl: z.string(),
  endpoints: z.record(
    z.string(),
    z.object({
      method: z.enum(["GET", "POST"]),
      path: z.string(),
      description: z.string(),
      timeout: z.number().optional(),
    })
  ),
});

export type ProxyEndpointsResponse = z.infer<
  typeof proxyEndpointsResponseSchema
>;

// ── Run record (Entity Worker → Gateway) ──

/** Schema for upserting a backfill run (POST body — client sends this). */
export const backfillRunRecord = z.object({
  entityType: z.string().min(1),
  since: z.string().min(1),
  depth: backfillDepthSchema,
  status: backfillRunStatusSchema,
  pagesProcessed: z.number().int().nonnegative().default(0),
  eventsProduced: z.number().int().nonnegative().default(0),
  eventsDispatched: z.number().int().nonnegative().default(0),
  error: z.string().optional(),
});
export type BackfillRunRecord = z.infer<typeof backfillRunRecord>;

/** Schema for reading a backfill run (GET response — server returns this).
 *  Extends the write record with server-computed timestamps. */
export const backfillRunReadRecord = backfillRunRecord.extend({
  completedAt: z.string().nullable(),
  startedAt: z.string().nullable().optional(),
});
export type BackfillRunReadRecord = z.infer<typeof backfillRunReadRecord>;

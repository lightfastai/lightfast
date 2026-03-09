import type { ProviderName } from "./providers";

/**
 * Payload passed from the thin webhook route to the durable receipt workflow.
 * Contains all data extracted after signature verification and JSON parsing.
 */
export interface WebhookReceiptPayload {
  /** Cross-service correlation ID for distributed tracing */
  correlationId?: string;
  deliveryId: string;
  eventType: string;
  payload: unknown;
  provider: ProviderName;
  receivedAt: number;
  resourceId: string | null;
}

/**
 * Envelope sent from Gateway to Console ingress via QStash.
 * This is the Gateway→Console contract for webhook delivery.
 */
export interface WebhookEnvelope {
  /** Gateway installation ID (gw_installations.id) */
  connectionId: string;
  /** Cross-service correlation ID for distributed tracing */
  correlationId?: string;
  /** Unique delivery ID for deduplication */
  deliveryId: string;
  /** Provider-specific event type (e.g., "push", "deployment.created", "Issue:create") */
  eventType: string;
  /** Clerk organization ID */
  orgId: string;
  /** Raw provider webhook payload */
  payload: unknown;
  /** Provider name */
  provider: ProviderName;
  /** Unix timestamp in milliseconds when the webhook was received */
  receivedAt: number;
}

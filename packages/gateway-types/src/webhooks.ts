import type { ProviderName } from "./providers";

/**
 * Payload passed from the thin webhook route to the durable receipt workflow.
 * Contains all data extracted after signature verification and JSON parsing.
 */
export interface WebhookReceiptPayload {
  provider: ProviderName;
  deliveryId: string;
  eventType: string;
  resourceId: string | null;
  payload: unknown;
  receivedAt: number;
}

/**
 * Envelope sent from Gateway to Console ingress via QStash.
 * This is the Gateway→Console contract for webhook delivery.
 */
export interface WebhookEnvelope {
  /** Unique delivery ID for deduplication */
  deliveryId: string;
  /** Gateway installation ID (gw_installations.id) */
  connectionId: string;
  /** Clerk organization ID */
  orgId: string;
  /** Provider name */
  provider: ProviderName;
  /** Provider-specific event type (e.g., "push", "deployment.created", "Issue:create") */
  eventType: string;
  /** Raw provider webhook payload */
  payload: unknown;
  /** Unix timestamp in milliseconds when the webhook was received */
  receivedAt: number;
}

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

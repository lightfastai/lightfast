/**
 * Payload passed from the thin webhook route to the durable receipt workflow.
 * Contains all data extracted before signature verification and JSON parsing.
 */
export interface WebhookReceiptPayload {
  provider: string;
  deliveryId: string;
  eventType: string;
  resourceId: string | null;
  payload: unknown;
  receivedAt: number;
}

/**
 * Context for webhook-to-event transformation.
 */
export interface TransformContext {
  deliveryId: string;
  receivedAt: Date;
  eventType: string;
}

/**
 * Redis key convention functions for the Gateway service.
 *
 * All keys are namespaced under `gw:` to avoid collisions.
 */
import type { SourceType } from "@repo/console-validation";

/** Resource → connection mapping (for webhook routing) */
export const resourceKey = (provider: SourceType, resourceId: string) =>
  `gw:resource:${provider}:${resourceId}`;

/** Deduplication key for received webhooks (TTL 86400s) */
export const webhookSeenKey = (provider: SourceType, deliveryId: string) =>
  `gw:webhook:seen:${provider}:${deliveryId}`;

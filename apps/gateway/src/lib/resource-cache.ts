import type { ProviderName } from "../providers/types";
import { redis } from "./redis";
import { resourceKey } from "./keys";

/**
 * Populate the Redis routing cache for a resource.
 * Used by: resource link, webhook-receipt fallthrough, admin cache rebuild.
 */
export async function setResourceCache(
  provider: ProviderName,
  providerResourceId: string,
  data: { connectionId: string; orgId: string },
): Promise<void> {
  await redis.hset(resourceKey(provider, providerResourceId), data);
}

/**
 * Remove a resource from the Redis routing cache.
 * Used by: resource unlink, connection teardown.
 */
export async function deleteResourceCache(
  provider: ProviderName,
  providerResourceId: string,
): Promise<void> {
  await redis.del(resourceKey(provider, providerResourceId));
}

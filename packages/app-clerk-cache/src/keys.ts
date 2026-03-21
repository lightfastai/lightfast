/**
 * Cache key utilities for Clerk membership caching.
 * Pattern: clerk:user-orgs:{userId}
 */

const CACHE_PREFIX = "clerk:user-orgs";

export function getUserOrgsCacheKey(userId: string): string {
  return `${CACHE_PREFIX}:${userId}`;
}

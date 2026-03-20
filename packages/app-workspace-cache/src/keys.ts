/**
 * Cache key utilities for workspace config caching.
 * Pattern: ws:{workspaceId}:config
 */

const CACHE_PREFIX = "ws";

export function getWorkspaceConfigCacheKey(workspaceId: string): string {
  return `${CACHE_PREFIX}:${workspaceId}:config`;
}

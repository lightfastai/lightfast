import { redis } from "@vendor/upstash";
import { clerkClient } from "@vendor/clerk/server";
import { log } from "@vendor/observability/log";
import { getUserOrgsCacheKey } from "./keys";
import type { CachedUserOrgMembership, GetMembershipsResult } from "./types";

/** Cache TTL in seconds (5 minutes) */
const CACHE_TTL_SECONDS = 300;

/**
 * Get user's organization memberships with Redis caching.
 *
 * Strategy: User-centric lookup - fetches user's orgs (typically 1-5)
 * instead of org's members (could be 100+). This is O(user_orgs) vs O(org_size).
 *
 * Flow:
 * 1. Try Redis cache lookup
 * 2. On hit: return cached data
 * 3. On miss: fetch from Clerk API, cache result, return
 * 4. On error: log warning, fall back to direct Clerk API
 *
 * @param userId - Clerk user ID
 * @returns Array of user's organization memberships (empty if none)
 */
export async function getCachedUserOrgMemberships(
  userId: string
): Promise<GetMembershipsResult> {
  const cacheKey = getUserOrgsCacheKey(userId);

  // 1. Try cache lookup
  try {
    const cached = await redis.get<CachedUserOrgMembership[]>(cacheKey);

    if (cached !== null) {
      log.debug("Clerk membership cache hit", { userId, count: cached.length });
      return cached;
    }

    log.debug("Clerk membership cache miss", { userId });
  } catch (cacheError) {
    // Cache read failed - log and continue to Clerk API
    log.warn("Clerk membership cache read failed", {
      userId,
      error: cacheError instanceof Error ? cacheError.message : String(cacheError),
    });
  }

  // 2. Fetch from Clerk API
  const memberships = await fetchUserOrgMembershipsFromClerk(userId);

  // 3. Cache the result (fire-and-forget, don't block response)
  cacheUserOrgMemberships(userId, memberships).catch((cacheError) => {
    log.warn("Clerk membership cache write failed", {
      userId,
      error: cacheError instanceof Error ? cacheError.message : String(cacheError),
    });
  });

  return memberships;
}

/**
 * Fetch user's organization memberships directly from Clerk API.
 * Used on cache miss or as fallback on cache failure.
 */
async function fetchUserOrgMembershipsFromClerk(
  userId: string
): Promise<CachedUserOrgMembership[]> {
  const clerk = await clerkClient();

  const response = await clerk.users.getOrganizationMembershipList({
    userId,
  });

  return response.data.map((membership) => ({
    organizationId: membership.organization.id,
    organizationSlug: membership.organization.slug,
    organizationName: membership.organization.name,
    role: membership.role,
    imageUrl: membership.organization.imageUrl,
  }));
}

/**
 * Cache user's organization memberships in Redis.
 */
async function cacheUserOrgMemberships(
  userId: string,
  memberships: CachedUserOrgMembership[]
): Promise<void> {
  const cacheKey = getUserOrgsCacheKey(userId);
  await redis.set(cacheKey, memberships, { ex: CACHE_TTL_SECONDS });
  log.debug("Clerk membership cached", { userId, count: memberships.length });
}

/**
 * Invalidate cached memberships for a user.
 * Call this when membership changes are detected (e.g., via webhooks).
 *
 * TODO: Integrate with Clerk webhook handler when implemented
 */
export async function invalidateUserOrgMemberships(userId: string): Promise<void> {
  const cacheKey = getUserOrgsCacheKey(userId);
  await redis.del(cacheKey);
  log.info("Clerk membership cache invalidated", { userId });
}

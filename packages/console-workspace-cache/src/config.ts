import { redis } from "@vendor/upstash";
import { db } from "@db/console/client";
import { orgWorkspaces, workspaceObservationClusters, workspaceActorProfiles } from "@db/console/schema";
import { eq, sql } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { getWorkspaceConfigCacheKey } from "./keys";
import type { CachedWorkspaceConfig } from "./types";

/** Cache TTL in seconds (1 hour - workspace config rarely changes) */
const CACHE_TTL_SECONDS = 3600;

/**
 * Get workspace configuration with Redis caching.
 *
 * Strategy: Cache the minimal config needed for search operations.
 * Workspace config changes infrequently, so 1-hour TTL is safe.
 *
 * Flow:
 * 1. Try Redis cache lookup
 * 2. On hit: return cached data
 * 3. On miss: fetch from DB, cache result, return
 * 4. On error: log warning, fall back to direct DB query
 *
 * @param workspaceId - Workspace ID
 * @returns Workspace config or null if not configured for search
 */
export async function getCachedWorkspaceConfig(
  workspaceId: string
): Promise<CachedWorkspaceConfig | null> {
  const cacheKey = getWorkspaceConfigCacheKey(workspaceId);

  // 1. Try cache lookup
  try {
    const cached = await redis.get<CachedWorkspaceConfig>(cacheKey);

    if (cached !== null) {
      log.debug("Workspace config cache hit", { workspaceId });
      return cached;
    }

    log.debug("Workspace config cache miss", { workspaceId });
  } catch (cacheError) {
    // Cache read failed - log and continue to DB
    log.warn("Workspace config cache read failed", {
      workspaceId,
      error: cacheError instanceof Error ? cacheError.message : String(cacheError),
    });
  }

  // 2. Fetch from database
  const config = await fetchWorkspaceConfigFromDB(workspaceId);

  if (!config) {
    // Workspace not configured for search - don't cache null
    return null;
  }

  // 3. Cache the result (fire-and-forget, don't block response)
  cacheWorkspaceConfig(workspaceId, config).catch((cacheError) => {
    log.warn("Workspace config cache write failed", {
      workspaceId,
      error: cacheError instanceof Error ? cacheError.message : String(cacheError),
    });
  });

  return config;
}

/**
 * Fetch workspace config directly from database.
 * Used on cache miss or as fallback on cache failure.
 *
 * Runs parallel queries for:
 * 1. Workspace settings (indexName, namespace, embedding config)
 * 2. Cluster count (capability detection)
 * 3. Actor count (capability detection)
 */
async function fetchWorkspaceConfigFromDB(
  workspaceId: string
): Promise<CachedWorkspaceConfig | null> {
  // Run all queries in parallel for efficiency
  const [workspace, clusterCountResult, actorCountResult] = await Promise.all([
    // 1. Workspace settings
    db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, workspaceId),
      columns: {
        indexName: true,
        namespaceName: true,
        embeddingModel: true,
        embeddingDim: true,
      },
    }),
    // 2. Cluster count (just need to know if > 0)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceObservationClusters)
      .where(eq(workspaceObservationClusters.workspaceId, workspaceId))
      .limit(1),
    // 3. Actor count (just need to know if > 0)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(workspaceActorProfiles)
      .where(eq(workspaceActorProfiles.workspaceId, workspaceId))
      .limit(1),
  ]);

  if (!workspace?.indexName || !workspace.namespaceName) {
    return null;
  }

  const clusterCount = clusterCountResult[0]?.count ?? 0;
  const actorCount = actorCountResult[0]?.count ?? 0;

  return {
    indexName: workspace.indexName,
    namespaceName: workspace.namespaceName,
    embeddingModel: workspace.embeddingModel,
    embeddingDim: workspace.embeddingDim,
    hasClusters: clusterCount > 0,
    hasActors: actorCount > 0,
  };
}

/**
 * Cache workspace config in Redis.
 */
async function cacheWorkspaceConfig(
  workspaceId: string,
  config: CachedWorkspaceConfig
): Promise<void> {
  const cacheKey = getWorkspaceConfigCacheKey(workspaceId);
  await redis.set(cacheKey, config, { ex: CACHE_TTL_SECONDS });
  log.debug("Workspace config cached", { workspaceId });
}

/**
 * Invalidate cached workspace config.
 * Call this when workspace settings are updated.
 */
export async function invalidateWorkspaceConfig(workspaceId: string): Promise<void> {
  const cacheKey = getWorkspaceConfigCacheKey(workspaceId);
  await redis.del(cacheKey);
  log.info("Workspace config cache invalidated", { workspaceId });
}

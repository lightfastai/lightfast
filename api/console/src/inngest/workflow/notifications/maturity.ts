/**
 * Workspace maturity detection
 *
 * Determines a workspace's notification maturity stage based on
 * observation volume, source diversity, and correlation density.
 * Used to gate notification volume for new vs established workspaces.
 *
 * Uses Upstash Redis for caching (1-hour TTL) since Inngest functions
 * run in serverless — in-memory caches don't persist across invocations.
 */

import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import { eq, count, sql } from "drizzle-orm";
import { redis } from "@vendor/upstash";
import { log } from "@vendor/observability/log";
import type { WorkspaceMaturity } from "@repo/console-types";

/** Redis key prefix for workspace maturity cache */
const MATURITY_CACHE_PREFIX = "notification:maturity:";
/** Cache TTL in seconds (1 hour) */
const CACHE_TTL_SECONDS = 3600;

export async function getWorkspaceMaturity(
  workspaceId: string,
): Promise<WorkspaceMaturity> {
  // Try Redis cache first
  try {
    const cached = await redis.get<WorkspaceMaturity>(
      `${MATURITY_CACHE_PREFIX}${workspaceId}`,
    );
    if (cached) {
      return cached;
    }
  } catch (error) {
    log.warn("Maturity cache read failed, falling back to DB", {
      workspaceId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Cache miss — compute from DB
  const [obsResult, sourceResult, relResult] = await Promise.all([
    db
      .select({ count: count() })
      .from(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, workspaceId)),
    db
      .select({
        count:
          sql<number>`count(distinct ${workspaceNeuralObservations.source})`.as(
            "count",
          ),
      })
      .from(workspaceNeuralObservations)
      .where(eq(workspaceNeuralObservations.workspaceId, workspaceId)),
    db
      .select({ count: count() })
      .from(workspaceObservationRelationships)
      .where(
        eq(workspaceObservationRelationships.workspaceId, workspaceId),
      ),
  ]);

  const observationCount = obsResult[0]?.count ?? 0;
  const sourceCount = sourceResult[0]?.count ?? 0;
  const relationshipCount = relResult[0]?.count ?? 0;

  let maturity: WorkspaceMaturity;
  if (observationCount >= 500 && sourceCount >= 3 && relationshipCount > 0) {
    maturity = "mature";
  } else if (observationCount >= 50 && sourceCount >= 2) {
    maturity = "growing";
  } else {
    maturity = "seed";
  }

  // Cache result (fire-and-forget)
  redis
    .set(`${MATURITY_CACHE_PREFIX}${workspaceId}`, maturity, {
      ex: CACHE_TTL_SECONDS,
    })
    .catch((error) => {
      log.warn("Maturity cache write failed", {
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return maturity;
}

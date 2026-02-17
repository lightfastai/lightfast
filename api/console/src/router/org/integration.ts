import type { TRPCRouterRecord } from "@trpc/server";
import {
  // New 2-table system
  userSources,
} from "@db/console/schema";
import type {UserSource} from "@db/console/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { db } from "@db/console/client";

/**
 * Integration Router (Simplified 2-Table Model)
 *
 * Manages user OAuth connections and workspace sources.
 *
 * New Flow:
 * 1. User completes OAuth → creates userSource (personal connection)
 * 2. User picks repo/team → creates workspaceSource (directly links to workspace)
 *
 * No more intermediate integrationResources table!
 */

/**
 * Helper: Verify user owns source
 */
async function verifyUserSourceOwnership(
  userId: string,
  userSourceId: string
): Promise<UserSource> {
  const result = await db
    .select()
    .from(userSources)
    .where(
      and(
        eq(userSources.id, userSourceId),
        eq(userSources.userId, userId)
      )
    )
    .limit(1);

  const userSource = result[0];

  if (!userSource) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "User source not found or access denied",
    });
  }

  return userSource;
}

// Suppress unused export warning - kept for future use
void verifyUserSourceOwnership;

/**
 * Integration Router (Org-scoped operations)
 *
 * Note: All integration procedures have been moved to user router for pending user support.
 * - userSources.github.get - Get GitHub integration
 * - userSources.github.repositories - List repositories
 * - userSources.github.detectConfig - Detect repository config
 * - workspaceAccess.create - Create workspace with optional repository connection
 *
 * This router is kept for potential future org-scoped integration operations.
 */
export const integrationRouter = {
  github: {},
} satisfies TRPCRouterRecord;

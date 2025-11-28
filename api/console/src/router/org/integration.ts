import type { TRPCRouterRecord } from "@trpc/server";
import {
  // New 2-table system
  userSources,
  workspaceIntegrations,
  type UserSource,
  // Common
  orgWorkspaces,
} from "@db/console/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  getUserInstallations,
  getInstallationRepositories,
  createGitHubApp,
  type GitHubInstallation,
} from "@repo/console-octokit-github";
import { decrypt } from "@repo/lib";
import { getWorkspaceKey } from "@db/console/utils";
import { inngest } from "@api/console/inngest";
import { env } from "../../env";
import yaml from "yaml";

import { orgScopedProcedure, resolveWorkspaceByName } from "../../trpc";
import { recordActivity } from "../../lib/activity";

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
 * Helper: Create GitHub App instance
 */
function getGitHubApp() {
  return createGitHubApp(
    {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
    },
    true // Format private key
  );
}

/**
 * Helper: Verify user owns source
 */
async function verifyUserSourceOwnership(
  ctx: any,
  userSourceId: string
): Promise<UserSource> {
  const result = await ctx.db
    .select()
    .from(userSources)
    .where(
      and(
        eq(userSources.id, userSourceId),
        eq(userSources.userId, ctx.auth.userId)
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

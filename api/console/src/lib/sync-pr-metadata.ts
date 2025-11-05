import { db } from "@db/console/client";
import { DeusCodeReview, DeusConnectedRepository } from "@db/console/schema";
import { eq } from "drizzle-orm";

import type { CodeReviewMetadata } from "@repo/console-types/code-review";

import { createGitHubApp, getPullRequest } from "@repo/console-octokit-github";
import { env } from "../env";

/**
 * Helper to create the GitHub App instance with environment config
 */
function getApp() {
  return createGitHubApp(
    {
      appId: env.GITHUB_APP_ID,
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
    },
    true, // Format the private key
  );
}

/**
 * Sync PR metadata from GitHub API to code review record
 *
 * This is called:
 * 1. When creating a new code review (initial sync)
 * 2. When user manually triggers a refresh
 * 3. As backup if webhooks fail
 *
 * @param reviewId - Code review ID to sync
 * @returns Updated metadata or null if sync failed
 */
export async function syncPRMetadata(
  reviewId: string,
): Promise<CodeReviewMetadata | null> {
  // 1. Fetch the code review and repository
  const reviewResult = await db
    .select()
    .from(DeusCodeReview)
    .where(eq(DeusCodeReview.id, reviewId))
    .limit(1);

  const review = reviewResult[0];

  if (!review) {
    console.error(`[Sync] Code review ${reviewId} not found`);
    return null;
  }

  const repoResult = await db
    .select()
    .from(DeusConnectedRepository)
    .where(eq(DeusConnectedRepository.id, review.repositoryId))
    .limit(1);

  const repo = repoResult[0];

  if (!repo) {
    console.error(`[Sync] Repository ${review.repositoryId} not found`);
    return null;
  }

  // 2. Extract owner/repo from cached metadata or githubRepoId
  const fullName = repo.metadata?.fullName;
  if (!fullName || typeof fullName !== "string") {
    console.error(`[Sync] Repository ${repo.id} missing fullName in metadata`);
    return null;
  }

  const [owner, repoName] = fullName.split("/");
  if (!owner || !repoName) {
    console.error(`[Sync] Invalid fullName format: ${fullName}`);
    return null;
  }

  try {
    // 3. Fetch fresh PR data from GitHub API
    const app = getApp();
    const pr = await getPullRequest(
      app,
      Number(repo.githubInstallationId),
      owner,
      repoName,
      review.pullRequestNumber,
    );

    // 4. Build updated metadata
    const updatedMetadata: CodeReviewMetadata = {
      ...review.metadata,
      prTitle: pr.title,
      prState: pr.state,
      prMerged: pr.merged ?? false,
      prAuthor: pr.user?.login,
      prAuthorAvatar: pr.user?.avatar_url,
      prUrl: pr.html_url,
      branch: pr.head.ref,
      lastSyncedAt: new Date().toISOString(),
    };

    // 5. Update database
    await db
      .update(DeusCodeReview)
      .set({ metadata: updatedMetadata })
      .where(eq(DeusCodeReview.id, reviewId));

    console.log(
      `[Sync] Successfully synced PR metadata for review ${reviewId}`,
    );
    return updatedMetadata;
  } catch (error) {
    console.error(
      `[Sync] Failed to sync PR metadata for review ${reviewId}:`,
      error,
    );

    // Handle 404 - PR deleted
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404
    ) {
      const deletedMetadata: CodeReviewMetadata = {
        ...review.metadata,
        deleted: true,
        deletedAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
      };

      await db
        .update(DeusCodeReview)
        .set({ metadata: deletedMetadata })
        .where(eq(DeusCodeReview.id, reviewId));

      return deletedMetadata;
    }

    return null;
  }
}

/**
 * Create initial PR metadata when creating a code review
 *
 * @param installationId - GitHub App installation ID
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param pullNumber - Pull request number
 * @returns Initial metadata or null if fetch failed
 */
export async function createInitialPRMetadata(
  installationId: number,
  owner: string,
  repo: string,
  pullNumber: number,
): Promise<CodeReviewMetadata | null> {
  try {
    const app = getApp();
    const pr = await getPullRequest(app, installationId, owner, repo, pullNumber);

    return {
      prTitle: pr.title,
      prState: pr.state,
      prMerged: pr.merged ?? false,
      prAuthor: pr.user?.login,
      prAuthorAvatar: pr.user?.avatar_url,
      prUrl: pr.html_url,
      branch: pr.head.ref,
      lastSyncedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`[Sync] Failed to fetch initial PR metadata:`, error);
    return null;
  }
}

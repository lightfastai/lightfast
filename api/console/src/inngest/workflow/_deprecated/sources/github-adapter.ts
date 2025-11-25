/**
 * GitHub adapter workflow (Phase 1.5)
 *
 * Bridges GitHub-specific events to generic multi-source workflows
 * Transforms GitHub file events into generic document events
 *
 * This adapter allows us to use the new multi-source infrastructure
 * while maintaining GitHub-only implementation for Phase 1.5
 */

import { inngest } from "../../../client/client";
import { log } from "@vendor/observability/log";
import {
  createGitHubApp,
  getThrottledInstallationOctokit,
  GitHubContentService,
} from "@repo/console-octokit-github";
import { parseMDX } from "@repo/console-chunking";
import { createHash } from "node:crypto";
import { env } from "../../../env";

/**
 * GitHub file processing adapter
 *
 * Receives: apps-console/docs.file.process (GitHub-specific)
 * Emits: apps-console/documents.process (generic)
 */
export const githubProcessAdapter = inngest.createFunction(
  {
    id: "apps-console/github-process-adapter",
    name: "GitHub Process Adapter",
    description: "Transforms GitHub file events to generic document events",
    retries: 3,

    // Use same idempotency as old workflow
    idempotency:
      'event.data.storeSlug + "-" + event.data.filePath + "-" + event.data.commitSha',

    timeouts: {
      start: "1m",
      finish: "5m",
    },
  },
  { event: "apps-console/docs.file.process" },
  async ({ event, step }: { event: any; step: any }) => {
    const {
      workspaceId,
      storeSlug,
      repoFullName,
      githubInstallationId,
      filePath,
      commitSha,
      committedAt,
    } = event.data;

    log.info("GitHub process adapter", {
      workspaceId,
      storeSlug,
      filePath,
      commitSha,
    });

    // Step 1: Fetch file content from GitHub
    const fileData = await step.run("fetch-file-content", async () => {
      try {
        const app = createGitHubApp({
          appId: env.GITHUB_APP_ID,
          privateKey: env.GITHUB_APP_PRIVATE_KEY,
        });

        const octokit = await getThrottledInstallationOctokit(
          app,
          githubInstallationId,
        );

        const contentService = new GitHubContentService(octokit);
        const [owner, repo] = repoFullName.split("/");

        if (!owner || !repo) {
          throw new Error(`Invalid repository full name: ${repoFullName}`);
        }

        const file = await contentService.fetchSingleFile(
          owner,
          repo,
          filePath,
          commitSha,
        );

        if (!file) {
          throw new Error(`File not found: ${filePath} at ${commitSha}`);
        }

        // Parse MDX to extract frontmatter and content hash
        const parsed = await parseMDX(filePath, file.content);

        log.info("Fetched GitHub file", {
          filePath,
          commitSha,
          slug: parsed.slug,
          contentHash: parsed.contentHash,
        });

        return {
          content: file.content,
          slug: parsed.slug,
          contentHash: parsed.contentHash,
          frontmatter: parsed.frontmatter,
        };
      } catch (error) {
        log.error("Failed to fetch GitHub file", {
          error,
          filePath,
          commitSha,
        });
        throw error;
      }
    });

    // Step 2: Transform to generic format and send to generic processor
    await step.run("send-to-generic-processor", async () => {
      const documentId = `github_${repoFullName.replace(/\//g, "_")}_${fileData.slug.replace(/\//g, "_")}`;

      // Extract title from frontmatter or use filename
      const title =
        (fileData.frontmatter?.title as string | undefined) ??
        filePath.split("/").pop()?.replace(/\.(md|mdx)$/, "") ??
        filePath;

      await inngest.send({
        name: "apps-console/documents.process",
        data: {
          workspaceId,
          storeSlug,
          documentId,

          // Multi-source fields
          sourceType: "github" as const,
          sourceId: filePath, // GitHub uses file path as source ID
          sourceMetadata: {
            repoFullName,
            commitSha,
            committedAt,
            githubInstallationId,
            frontmatter: fileData.frontmatter,
          },

          // Document content
          title,
          content: fileData.content,
          contentHash: fileData.contentHash,

          // Optional fields
          metadata: {
            slug: fileData.slug,
            frontmatter: fileData.frontmatter,
          },
          relationships: extractGitHubRelationships(fileData.content, {
            repoFullName,
            filePath,
            commitSha,
          }),
        },
      });

      log.info("Sent to generic processor", {
        documentId,
        sourceType: "github",
        sourceId: filePath,
      });
    });

    return {
      status: "processed",
      filePath,
      sourceType: "github",
    };
  },
);

/**
 * GitHub file deletion adapter
 *
 * Receives: apps-console/docs.file.delete (GitHub-specific)
 * Emits: apps-console/documents.delete (generic)
 */
export const githubDeleteAdapter = inngest.createFunction(
  {
    id: "apps-console/github-delete-adapter",
    name: "GitHub Delete Adapter",
    description: "Transforms GitHub delete events to generic document deletes",
    retries: 2,

    // Use file path for idempotency
    idempotency: 'event.data.storeSlug + "-" + event.data.filePath',

    timeouts: {
      start: "30s",
      finish: "2m",
    },
  },
  { event: "apps-console/docs.file.delete" },
  async ({ event, step }: { event: any; step: any }) => {
    const { workspaceId, storeSlug, repoFullName, filePath } = event.data;

    log.info("GitHub delete adapter", {
      workspaceId,
      storeSlug,
      filePath,
    });

    await step.run("send-to-generic-deleter", async () => {
      // Generate document ID (same format as process adapter)
      const slugPath = filePath.replace(/\.(md|mdx)$/, "").replace(/\//g, "_");
      const documentId = `github_${repoFullName.replace(/\//g, "_")}_${slugPath}`;

      await inngest.send({
        name: "apps-console/documents.delete",
        data: {
          workspaceId,
          storeSlug,
          documentId,

          // Multi-source fields
          sourceType: "github" as const,
          sourceId: filePath,
        },
      });

      log.info("Sent to generic deleter", {
        documentId,
        sourceType: "github",
        sourceId: filePath,
      });
    });

    return {
      status: "deleted",
      filePath,
      sourceType: "github",
    };
  },
);

/**
 * Extract relationships from GitHub markdown content
 */
function extractGitHubRelationships(
  content: string,
  metadata: {
    repoFullName: string;
    filePath: string;
    commitSha: string;
  },
): Record<string, unknown> {
  const relationships: Record<string, unknown> = { ...metadata };

  // Extract issue/PR references (e.g., #123, owner/repo#456)
  const issuePattern = /(?:^|\s)(?:([\w-]+\/[\w-]+)?#(\d+))/g;
  const issueMatches = [...content.matchAll(issuePattern)];

  if (issueMatches.length > 0) {
    relationships.githubReferences = issueMatches.map((match) => {
      const [, repo, number] = match;
      return {
        repo: repo || metadata.repoFullName,
        number,
        type: "issue_or_pr",
      };
    });
  }

  // Extract commit SHAs (7-40 char hex strings)
  const commitPattern = /\b([a-f0-9]{7,40})\b/gi;
  const commitMatches = [...content.matchAll(commitPattern)];

  if (commitMatches.length > 0) {
    relationships.potentialCommits = commitMatches
      .map((m) => m[1])
      .filter((sha) => sha !== metadata.commitSha) // Exclude current commit
      .slice(0, 10); // Limit to first 10
  }

  return relationships;
}

/**
 * GitHub Document Adapters
 *
 * These adapters transform GitHub-specific events into generic document events.
 * They handle:
 * 1. Fetching file content from GitHub
 * 2. Generating content hashes
 * 3. Transforming to generic document format
 * 4. Forwarding to generic document processors
 *
 * This adapter pattern allows the GitHub sync workflow to remain lightweight
 * while offloading expensive file fetching to parallel worker functions.
 */

import { inngest } from "../../client/client";
import { createHash } from "node:crypto";
import { log } from "@vendor/observability/log";
import { env } from "../../../env";
import {
  createGitHubApp,
  getThrottledInstallationOctokit,
  GitHubContentService,
} from "@repo/console-octokit-github";

/**
 * GitHub File Process Adapter
 *
 * Listens to: apps-console/docs.file.process
 * Emits: apps-console/documents.process
 *
 * Fetches GitHub file content and transforms to generic document format.
 */
export const githubProcessAdapter = inngest.createFunction(
  {
    id: "apps-console/github-process-adapter",
    name: "GitHub Process Adapter",
    description: "Fetches GitHub file content and adapts to generic document format",
    retries: 3,

    // Batch events per repository for efficient GitHub API usage
    // Note: Idempotency handled downstream in process-documents via contentHash
    batchEvents: {
      maxSize: 50,
      timeout: "10s",
      key: 'event.data.repoFullName + ":" + event.data.githubInstallationId',
    },

    // Limit concurrent GitHub API calls
    concurrency: [
      {
        key: "event.data.githubInstallationId",
        limit: 10,
      },
    ],

    timeouts: {
      start: "1m",
      finish: "10m",
    },
  },
  { event: "apps-console/docs.file.process" },
  async ({ events, step }) => {
    if (!events.length) {
      return { processed: 0, failed: 0 };
    }

    const sample = events[0];
    log.info("GitHub process adapter started", {
      repoFullName: sample.data.repoFullName,
      count: events.length,
    });

    // Step 1: Fetch all file contents from GitHub
    const filesWithContent = await step.run("github.fetch-files", async () => {
      const app = createGitHubApp({
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      });

      const octokit = await getThrottledInstallationOctokit(
        app,
        sample.data.githubInstallationId
      );

      const contentService = new GitHubContentService(octokit);
      const [owner, repo] = sample.data.repoFullName.split("/");

      if (!owner || !repo) {
        throw new Error(`Invalid repository name: ${sample.data.repoFullName}`);
      }

      const results = await Promise.allSettled(
        events.map(async (event) => {
          try {
            const file = await contentService.fetchSingleFile(
              owner,
              repo,
              event.data.filePath,
              event.data.commitSha
            );

            if (!file) {
              log.warn("File not found in repository", {
                filePath: event.data.filePath,
                commitSha: event.data.commitSha,
              });
              return null;
            }

            // Generate content hash
            const contentHash = createHash("sha256")
              .update(file.content)
              .digest("hex");

            // Generate deterministic document ID
            const documentId = `github:${sample.data.repoFullName}:${event.data.filePath}`;

            return {
              event: event.data,
              file,
              documentId,
              contentHash,
            };
          } catch (error) {
            log.error("Failed to fetch file from GitHub", {
              error,
              filePath: event.data.filePath,
              commitSha: event.data.commitSha,
            });
            return null;
          }
        })
      );

      return results
        .map((result) => (result.status === "fulfilled" ? result.value : null))
        .filter((item): item is NonNullable<typeof item> => item !== null);
    });

    // Step 2: Transform to generic document events and send
    if (filesWithContent.length > 0) {
      await step.sendEvent(
        "documents.send-process-events",
        filesWithContent.map((item) => ({
          name: "apps-console/documents.process" as const,
          data: {
            workspaceId: item.event.workspaceId,
            storeSlug: item.event.storeSlug,
            documentId: item.documentId,
            sourceType: "github" as const,
            sourceId: item.event.filePath,
            sourceMetadata: {
              repoFullName: item.event.repoFullName,
              filePath: item.event.filePath,
              commitSha: item.event.commitSha,
              committedAt: item.event.committedAt,
              githubInstallationId: item.event.githubInstallationId,
            },
            title: item.file.path,
            content: item.file.content,
            contentHash: item.contentHash,
          },
        }))
      );
    }

    const processed = filesWithContent.length;
    const failed = events.length - processed;

    log.info("GitHub process adapter completed", {
      processed,
      failed,
      total: events.length,
    });

    return {
      processed,
      failed,
      total: events.length,
    };
  }
);

/**
 * GitHub File Delete Adapter
 *
 * Listens to: apps-console/docs.file.delete
 * Emits: apps-console/documents.delete
 *
 * Transforms GitHub file deletions to generic document deletions.
 */
export const githubDeleteAdapter = inngest.createFunction(
  {
    id: "apps-console/github-delete-adapter",
    name: "GitHub Delete Adapter",
    description: "Adapts GitHub file deletions to generic document deletions",
    retries: 3,

    // Batch deletions for efficiency
    batchEvents: {
      maxSize: 100,
      timeout: "5s",
      key: "event.data.workspaceId",
    },

    timeouts: {
      start: "30s",
      finish: "5m",
    },
  },
  { event: "apps-console/docs.file.delete" },
  async ({ events, step }) => {
    if (!events.length) {
      return { processed: 0 };
    }

    log.info("GitHub delete adapter started", {
      count: events.length,
    });

    // Transform and forward to generic delete
    await step.sendEvent(
      "documents.send-delete-events",
      events.map((event) => {
        // Generate deterministic document ID matching the one used in process adapter
        const documentId = `github:${event.data.repoFullName}:${event.data.filePath}`;

        return {
          name: "apps-console/documents.delete" as const,
          data: {
            workspaceId: event.data.workspaceId,
            storeSlug: event.data.storeSlug,
            documentId,
            sourceType: "github" as const,
            sourceId: event.data.filePath,
          },
        };
      })
    );

    log.info("GitHub delete adapter completed", {
      processed: events.length,
    });

    return {
      processed: events.length,
    };
  }
);

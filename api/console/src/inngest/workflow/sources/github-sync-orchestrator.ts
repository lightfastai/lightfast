/**
 * GitHub Sync Orchestrator
 *
 * GitHub-specific orchestration that handles:
 * 1. Fetching files from GitHub (using Git Trees API for efficiency)
 * 2. Processing files in batches
 * 3. Emitting completion events
 *
 * Called by: sync-orchestrator after common setup
 */

import { inngest } from "../../client/client";
import type { Events } from "../../client/client";
import { log } from "@vendor/observability/log";
import {
  createGitHubApp,
  getThrottledInstallationOctokit,
  GitHubContentService,
} from "@repo/console-octokit-github";
import { validateConfig } from "@repo/console-config";
import { env } from "../../../env";
import yaml from "yaml";
import { minimatch } from "minimatch";
import { createHash } from "node:crypto";

// Helper to chunk array into batches
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Generate deterministic batch ID
function generateBatchId(jobId: string, index: number): string {
  return `${jobId}-batch-${index}`;
}

/**
 * GitHub Sync Orchestrator
 *
 * Handles GitHub-specific sync logic after common setup is complete.
 * Assumes store already exists and job is created.
 */
export const githubSyncOrchestrator = inngest.createFunction(
  {
    id: "apps-console/github.sync.orchestrator",
    name: "GitHub Sync Orchestrator",
    description: "GitHub-specific sync orchestration",
    retries: 3,

    // Only one sync per source at a time
    concurrency: {
      limit: 1,
      key: "event.data.sourceId",
    },

    timeouts: {
      start: "2m",
      finish: "20m", // GitHub can have large repos
    },
  },
  { event: "apps-console/github.sync.trigger" },
  async ({ event, step, logger }) => {
    const {
      jobId,
      workspaceId,
      sourceId,
      sourceConfig,
      syncMode = "full",
      syncParams = {},
    } = event.data;

    logger.info("GitHub sync orchestrator started", {
      jobId,
      sourceId,
      syncMode,
    });

    // Step 1: Fetch configuration and determine files to process
    const filesToProcess = await step.run("determine-files", async () => {
      const { repoFullName, defaultBranch, installationId } = sourceConfig as {
        repoFullName: string;
        defaultBranch: string;
        installationId: string;
      };

      // Create GitHub app and service
      const app = createGitHubApp({
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      });

      const octokit = await getThrottledInstallationOctokit(
        app,
        Number.parseInt(installationId, 10),
      );

      const contentService = new GitHubContentService(octokit);
      const [owner, repo] = repoFullName.split("/");

      if (!owner || !repo) {
        throw new Error(`Invalid repository name: ${repoFullName}`);
      }

      // Try to fetch config file
      let config: any = {};
      const configPaths = [
        "lightfast.yml",
        ".lightfast.yml",
        "lightfast.yaml",
        ".lightfast.yaml",
      ];

      for (const path of configPaths) {
        try {
          const file = await contentService.fetchSingleFile(
            owner,
            repo,
            path,
            defaultBranch,
          );

          if (file) {
            const parsed = yaml.parse(file.content);
            const validated = validateConfig(parsed);

            if (validated.isOk()) {
              config = validated.value;
              logger.info("Loaded config", { path, config });
              break;
            }
          }
        } catch (error) {
          continue;
        }
      }

      // Determine files based on sync mode
      if (syncMode === "incremental" && syncParams.changedFiles) {
        const changed = syncParams.changedFiles as Array<{
          path: string;
          status: "added" | "modified" | "removed";
        }>;

        const include = config.include || ["**/*"];
        const filtered = changed.filter((file) =>
          include.some((pattern: string) => minimatch(file.path, pattern)),
        );

        return filtered;
      } else {
        // Full sync: Use Git Trees API for efficiency (1 call for 100k files!)
        const allFiles = await contentService.listAllFiles(
          owner,
          repo,
          defaultBranch,
        );

        const include = config.include || ["**/*"];
        const filtered = allFiles
          .filter((file: { path: string }) =>
            include.some((pattern: string) => minimatch(file.path, pattern)),
          )
          .map((file: { path: string }) => ({
            path: file.path,
            status: "added" as const,
          }));

        return filtered;
      }
    });

    logger.info("Files to process", { count: filesToProcess.length });

    // Step 2: Process files in batches with completion tracking
    const batchSize = 50;
    const batches = chunkArray(filesToProcess, batchSize);

    // Send batch processing events
    const batchIds = await step.run("send-file-batches", async () => {
      const ids: string[] = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchId = generateBatchId(jobId, i);
        ids.push(batchId);

        await step.sendEvent(`file-batch-${i}`, {
          name: "apps-console/files.batch.process",
          data: {
            batchId,
            workspaceId,
            sourceId,
            files: batch || [],
            githubInstallationId: Number.parseInt(
              (sourceConfig as { installationId: string }).installationId,
              10,
            ),
            repoFullName: (sourceConfig as { repoFullName: string })
              .repoFullName,
            commitSha: (syncParams.afterSha as string) || "HEAD",
            committedAt:
              (syncParams.headCommitTimestamp as string) ||
              new Date().toISOString(),
          },
        });
      }

      return ids;
    });

    // Wait for all file batches to complete
    const batchResults = await Promise.all(
      batchIds.map((batchId: string, index: number) =>
        step.waitForEvent(`batch-${index}-complete`, {
          event: "apps-console/files.batch.completed",
          match: `data.batchId`,
          timeout: "10m",
        }),
      ),
    );

    // Check for failures and count results
    const fileMetrics = batchResults.reduce(
      (acc, result) => {
        if (result?.data) {
          acc.processed += result.data.processed || 0;
          acc.failed += result.data.failed || 0;
          if (!result.data.success) {
            acc.failedBatches++;
          }
        } else {
          acc.failedBatches++;
        }
        return acc;
      },
      { processed: 0, failed: 0, failedBatches: 0 },
    );

    logger.info("GitHub file processing complete", fileMetrics);

    // Step 3: Emit completion event
    await step.sendEvent("github-sync-completed", {
      name: "apps-console/github.sync.completed",
      data: {
        jobId,
        sourceId,
        success: fileMetrics.failedBatches === 0,
        filesProcessed: fileMetrics.processed,
        filesFailed: fileMetrics.failed,
      },
    });

    return {
      success: fileMetrics.failedBatches === 0,
      filesProcessed: fileMetrics.processed,
      filesFailed: fileMetrics.failed,
    };
  },
);


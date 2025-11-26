/**
 * GitHub Sync Workflow
 *
 * Handles both FULL and INCREMENTAL syncs for GitHub repositories.
 *
 * FULL SYNC:
 * - Triggered on initial connection
 * - Triggered when lightfast.yml changes
 * - Triggered on manual "Restart" action
 * - Processes ALL files in repository matching config
 *
 * INCREMENTAL SYNC:
 * - Triggered by normal push webhooks
 * - Processes only changed files from changedFiles array
 *
 * This consolidates the logic from:
 * - repository-initial-sync.ts (full sync)
 * - docs-ingestion.ts (incremental sync)
 *
 * Into a single, unified GitHub sync workflow.
 */

import { inngest } from "../../../client/client";
import type { Events } from "../../../client/client";
import { db } from "@db/console/client";
import { orgWorkspaces, workspaceIntegrations } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { completeJob, updateJobStatus } from "../../../../lib/jobs";
import { log } from "@vendor/observability/log";
import { getWorkspaceKey } from "@db/console/utils";
import {
  createGitHubApp,
  getThrottledInstallationOctokit,
  GitHubContentService,
} from "@repo/console-octokit-github";
import { validateConfig } from "@repo/console-config";
import { env } from "../../../../env";
import yaml from "yaml";
import { minimatch } from "minimatch";
import { createHash } from "node:crypto";

type DispatchAction = "process" | "delete";

// Inngest requires deterministic, URL-safe IDs per step/event
const hashToken = (value: string): string =>
  createHash("sha1").update(value).digest("hex").slice(0, 12);

/**
 * GitHub Sync Workflow
 *
 * Unified sync handler for GitHub repositories.
 * Supports both full and incremental sync modes.
 */
export const githubSync = inngest.createFunction(
  {
    id: "apps-console/github-sync",
    name: "GitHub Sync",
    description: "Syncs GitHub repository content (full or incremental)",
    retries: 3,

    // Only one sync per source at a time
    // Subsequent syncs will be skipped if one is already running
    singleton: {
      key: "event.data.sourceId",
      mode: "skip",
    },

    // Cancel if source is disconnected
    cancelOn: [
      {
        event: "apps-console/source.disconnected",
        match: "data.sourceId",
      },
    ],

    timeouts: {
      start: "2m",
      finish: "15m",
    },
  },
  { event: "apps-console/github.sync" },
  async ({ event, step, runId }) => {
    const {
      workspaceId,
      workspaceKey,
      sourceId,
      syncMode,
      trigger,
      jobId,
      syncParams,
    } = event.data;

    log.info("GitHub sync started", {
      workspaceId,
      sourceId,
      syncMode,
      trigger,
      jobId,
    });

    // Step 1: Fetch workspace source
    const sourceData = await step.run("source.fetch", async () => {
      const source = await db.query.workspaceIntegrations.findFirst({
        where: eq(workspaceIntegrations.id, sourceId),
      });

      if (!source || source.sourceConfig.provider !== "github") {
        throw new Error("Invalid GitHub workspace source");
      }

      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
      });

      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      return {
        source,
        workspace,
        githubConfig: source.sourceConfig,
      };
    });

    const { repoFullName, defaultBranch, installationId, repoId } =
      sourceData.githubConfig;

    // Step 2: Ensure store exists
    const storeSlug = "default";

    await step.sendEvent("store.ensure", {
      name: "apps-console/store.ensure",
      data: {
        workspaceId,
        workspaceKey,
        storeSlug,
        repoFullName,
      },
    });

    // Step 3: Update workspace source sync status
    await step.run("sync.update-status-started", async () => {
      await db
        .update(workspaceIntegrations)
        .set({
          lastSyncStatus: "pending",
        })
        .where(eq(workspaceIntegrations.id, sourceId));
    });

    // Step 4: Fetch and validate lightfast.yml config
    const configResult = await step.run("config.load", async () => {
      const app = createGitHubApp({
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      });

      const octokit = await getThrottledInstallationOctokit(
        app,
        Number.parseInt(installationId, 10)
      );

      const contentService = new GitHubContentService(octokit);
      const [owner, repo] = repoFullName.split("/");

      if (!owner || !repo) {
        throw new Error(`Invalid repository name: ${repoFullName}`);
      }

      // Try to fetch config file
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
            defaultBranch
          );

          if (file) {
            const parsed = yaml.parse(file.content);
            const validated = validateConfig(parsed);

            if (validated.isOk()) {
              log.info("Loaded lightfast.yml config", {
                path,
                version: validated.value.version,
                includeCount: validated.value.include?.length || 0,
              });

              return validated;
            } else {
              log.warn("Invalid config file, trying next path", {
                path,
                error: validated.error.message,
              });
              continue;
            }
          }
        } catch (error) {
          // Continue to next config path
          continue;
        }
      }

      // No config found - use defaults
      log.warn("No lightfast.yml found, using defaults", { repoFullName });
      return validateConfig({});
    });

    // Unwrap config result or throw
    if ("error" in configResult) {
      throw new Error(
        `Failed to load config: ${configResult.error.message}`,
        { cause: configResult.error }
      );
    }
    const config = configResult.value;

    // Step 5: Determine which files to process
    const filesToProcess = await step.run("files.determine", async () => {
      if (syncMode === "incremental" && syncParams.changedFiles) {
        // Incremental: use changedFiles from webhook
        const changed = syncParams.changedFiles as Array<{
          path: string;
          status: "added" | "modified" | "removed";
        }>;

        // Filter by config patterns
        const filtered = changed.filter((file) => {
          const include = config.include || ["**/*"];

          const included = include.some((pattern: string) =>
            minimatch(file.path, pattern)
          );

          return included;
        });

        log.info("Filtered incremental files", {
          total: changed.length,
          filtered: filtered.length,
        });

        return filtered;
      } else {
        // Full sync: list ALL files matching config
        const app = createGitHubApp({
          appId: env.GITHUB_APP_ID,
          privateKey: env.GITHUB_APP_PRIVATE_KEY,
        });

        const octokit = await getThrottledInstallationOctokit(
          app,
          Number.parseInt(installationId, 10)
        );

        const contentService = new GitHubContentService(octokit);
        const [owner, repo] = repoFullName.split("/");

        if (!owner || !repo) {
          throw new Error(`Invalid repository name: ${repoFullName}`);
        }

        // List all files in repository
        const allFiles = await contentService.listAllFiles(
          owner,
          repo,
          defaultBranch
        );

        // Filter by config patterns
        const include = config.include || ["**/*"];

        const filtered = allFiles
          .filter((file: { path: string }) => {
            const included = include.some((pattern: string) =>
              minimatch(file.path, pattern)
            );

            return included;
          })
          .map((file: { path: string }) => ({
            path: file.path,
            status: "added" as const, // Treat all as "added" for full sync
          }));

        log.info("Filtered full sync files", {
          total: allFiles.length,
          filtered: filtered.length,
        });

        return filtered;
      }
    });

    // Step 6: Trigger file processing for each file
    // These GitHub-specific events are handled by adapters that:
    // 1. Fetch file content from GitHub
    // 2. Transform to generic document events
    // 3. Send to generic processors
    const eventIds = await step.sendEvent(
      "files.trigger-processing",
      filesToProcess.map((file) => {
        const commitSha = (syncParams.afterSha as string) || "HEAD";
        const committedAt =
          (syncParams.headCommitTimestamp as string) || new Date().toISOString();

        if (file.status === "removed") {
          // Adapter: githubDeleteAdapter → documents.delete
          return {
            name: "apps-console/docs.file.delete" as const,
            data: {
              workspaceId,
              storeSlug,
              repoFullName,
              filePath: file.path,
            },
          };
        } else {
          // Adapter: githubProcessAdapter → documents.process
          return {
            name: "apps-console/docs.file.process" as const,
            data: {
              workspaceId,
              storeSlug,
              repoFullName,
              githubInstallationId: Number.parseInt(installationId, 10),
              filePath: file.path,
              commitSha,
              committedAt,
            },
          };
        }
      })
    );

    await step.run("files.log-dispatch", async () => {
      log.info("Triggered file processing", {
        count: filesToProcess.length,
        syncMode,
        eventIds: eventIds.ids.length,
      });
    });

    // Step 7: Update workspace source sync status
    await step.run("sync.update-status-completed", async () => {
      await db
        .update(workspaceIntegrations)
        .set({
          lastSyncedAt: new Date().toISOString(),
          lastSyncStatus: "success",
        })
        .where(eq(workspaceIntegrations.id, sourceId));
    });

    // Step 8: Emit completion event for parent workflow
    await step.sendEvent("sync.emit-completion", {
      name: "apps-console/github.sync-completed",
      data: {
        sourceId,
        jobId,
        filesProcessed: filesToProcess.length,
        filesFailed: 0, // TODO: Track failures in Phase 2
        storeSlug,
        syncMode,
        timedOut: false,
      },
    });

    // Step 9: Job completion is handled by parent workflow (source-sync)
    // This workflow just emits the completion event above

    return {
      success: true,
      sourceId,
      repoFullName,
      syncMode,
      filesProcessed: filesToProcess.length,
      storeSlug,
    };
  }
);

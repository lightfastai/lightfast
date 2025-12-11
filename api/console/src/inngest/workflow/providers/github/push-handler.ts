/**
 * GitHub Push Webhook Handler
 *
 * Processes GitHub push webhooks and routes to unified sync orchestrator.
 *
 * Key behaviors:
 * 1. If lightfast.yml changed → trigger FULL sync (config may have changed)
 * 2. If normal push → trigger INCREMENTAL sync (only changed files)
 *
 * Routes to: sync.orchestrator via sync.requested event
 */

import { inngest } from "../../../client/client";
import { db } from "@db/console/client";
import { workspaceIntegrations, workspaceStores } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { createGitHubApp, ConfigDetectorService } from "@repo/console-octokit-github";
import { env } from "../../../../env";

// Config file names to watch for
const CONFIG_FILE_NAMES = [
  "lightfast.yml",
  ".lightfast.yml",
  "lightfast.yaml",
  ".lightfast.yaml",
];

/**
 * GitHub Push Handler
 *
 * Routes GitHub push events to the appropriate sync workflow:
 * - Config changed → full sync
 * - Normal push → incremental sync
 */
export const githubPushHandler = inngest.createFunction(
  {
    id: "apps-console/github-push-handler",
    name: "GitHub Push Handler",
    description: "Routes GitHub push webhooks to sync workflows",
    retries: 3,

    // Prevent duplicate processing of same webhook delivery
    idempotency: "event.data.deliveryId",

    // Latest push always wins - cancel current sync to process new one
    // This ensures config changes are never skipped
    singleton: {
      key: "event.data.sourceId",
      mode: "cancel",
    },

    timeouts: {
      start: "1m",
      finish: "10m",
    },
  },
  { event: "apps-console/github.push" },
  async ({ event, step }) => {
    const {
      workspaceId,
      workspaceKey,
      sourceId,
      repoFullName,
      githubRepoId,
      githubInstallationId,
      beforeSha,
      afterSha,
      branch,
      deliveryId,
      headCommitTimestamp,
      changedFiles,
    } = event.data;

    log.info("GitHub push received", {
      workspaceId,
      sourceId,
      repoFullName,
      branch,
      changedCount: changedFiles.length,
      deliveryId,
    });

    // Step 1: Resolve storeId (workspaceId = storeId, 1:1 relationship)
    const storeId = await step.run("store.resolve", async () => {
      const store = await db.query.workspaceStores.findFirst({
        where: eq(workspaceStores.workspaceId, workspaceId),
      });

      if (!store) {
        throw new Error(`Store not found for workspace: ${workspaceId}`);
      }

      return store.id;
    });

    // Step 2: Validate source exists
    await step.run("source.validate", async () => {
      const source = await db.query.workspaceIntegrations.findFirst({
        where: eq(workspaceIntegrations.id, sourceId),
      });

      if (!source) {
        throw new Error(`Workspace source not found: ${sourceId}`);
      }

      if (!source.isActive) {
        log.warn("Ignoring push for inactive source", { sourceId });
        throw new Error(`Source is inactive: ${sourceId}`);
      }

      // Verify it's a GitHub source
      if (source.sourceConfig.provider !== "github") {
        throw new Error(
          `Expected GitHub source, got: ${source.sourceConfig.provider}`
        );
      }
    });

    // Step 2: Check if lightfast.yml was modified and update DB status
    const configChanged = await step.run("config.check-changed", async () => {
      const hasConfigChange = changedFiles.some((file) =>
        CONFIG_FILE_NAMES.includes(file.path)
      );

      if (hasConfigChange) {
        log.info("Config file changed detected", {
          sourceId,
          files: changedFiles
            .filter((f) => CONFIG_FILE_NAMES.includes(f.path))
            .map((f) => f.path),
        });

        // Re-detect config and update DB status (moved from webhook handler)
        try {
          const app = createGitHubApp({
            appId: env.GITHUB_APP_ID,
            privateKey: env.GITHUB_APP_PRIVATE_KEY,
          });
          const detector = new ConfigDetectorService(app);
          const [owner, repo] = repoFullName.split("/");

          if (!owner || !repo) {
            log.error("Invalid repository full name", { repoFullName });
            return hasConfigChange;
          }

          const result = await detector.detectConfig(
            owner,
            repo,
            afterSha,
            githubInstallationId,
          );

          // Update config status directly in database
          const sources = await db
            .select()
            .from(workspaceIntegrations)
            .where(eq(workspaceIntegrations.providerResourceId, githubRepoId.toString()));

          if (sources.length > 0) {
            const now = new Date().toISOString();
            await Promise.all(
              sources.map((source) => {
                if (source.sourceConfig.provider !== "github") {
                  return Promise.resolve(null);
                }

                const updatedConfig = {
                  ...source.sourceConfig,
                  status: {
                    configStatus: result.exists ? "configured" as const : "unconfigured" as const,
                    configPath: result.path ?? undefined,
                    lastConfigCheck: now,
                  },
                };

                return db
                  .update(workspaceIntegrations)
                  .set({
                    sourceConfig: updatedConfig,
                    updatedAt: now,
                  })
                  .where(eq(workspaceIntegrations.id, source.id));
              })
            );

            log.info("Updated config status", {
              configStatus: result.exists ? "configured" : "unconfigured",
              configPath: result.path,
            });
          }
        } catch (e) {
          log.error("Config re-detection failed", { error: e });
          // Non-fatal: continue with sync even if config detection fails
        }
      }

      return hasConfigChange;
    });

    // Step 3: Route to appropriate sync workflow
    if (configChanged) {
      // Config changed → trigger FULL sync
      const eventIds = await step.sendEvent("sync.trigger-full", {
        name: "apps-console/sync.requested",
        data: {
          workspaceId,
          workspaceKey,
          sourceId,
          sourceType: "github",
          syncMode: "full",
          trigger: "config-change",
          syncParams: {},
        },
      });

      await step.run("sync.log-dispatch", async () => {
        log.info("Triggered full sync (config changed)", {
          sourceId,
          repoFullName,
          eventId: eventIds.ids[0],
        });
      });
    } else {
      // Normal push → trigger INCREMENTAL sync
      const eventIds = await step.sendEvent("sync.trigger-incremental", {
        name: "apps-console/sync.requested",
        data: {
          workspaceId,
          workspaceKey,
          sourceId,
          sourceType: "github",
          syncMode: "incremental",
          trigger: "webhook",
          syncParams: {
            changedFiles,
            afterSha,
            headCommitTimestamp,
          },
        },
      });

      await step.run("sync.log-dispatch", async () => {
        log.info("Triggered incremental sync (normal push)", {
          sourceId,
          repoFullName,
          changedCount: changedFiles.length,
          eventId: eventIds.ids[0],
        });
      });
    }

    return {
      success: true,
      sourceId,
      repoFullName,
      syncMode: configChanged ? "full" : "incremental",
      configChanged,
      filesProcessed: changedFiles.length,
    };
  }
);

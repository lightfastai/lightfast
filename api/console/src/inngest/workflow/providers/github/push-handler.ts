/**
 * GitHub Push Webhook Handler
 *
 * Processes GitHub push webhooks and routes to appropriate sync workflow.
 *
 * Key behaviors:
 * 1. If lightfast.yml changed → trigger FULL sync (config may have changed)
 * 2. If normal push → trigger INCREMENTAL sync (only changed files)
 *
 * This replaces the old docs-ingestion.ts with clear GitHub-specific naming
 * and explicit config change handling.
 */

import { inngest } from "../../../client/client";
import type { Events } from "../../../client/client";
import { db } from "@db/console/client";
import { workspaceSources, workspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { getWorkspaceKey } from "@db/console/utils";

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

    // Only process one push per source at a time
    // Skip if already processing (prevents concurrent updates)
    singleton: {
      key: "event.data.sourceId",
      mode: "skip",
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

    // Step 1: Validate source exists
    await step.run("validate-source", async () => {
      const source = await db.query.workspaceSources.findFirst({
        where: eq(workspaceSources.id, sourceId),
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

    // Step 2: Check if lightfast.yml was modified
    const configChanged = await step.run("check-config-changed", async () => {
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
      }

      return hasConfigChange;
    });

    // Step 3: Route to appropriate sync workflow
    if (configChanged) {
      // Config changed → trigger FULL sync
      await step.run("trigger-full-sync", async () => {
        await inngest.send({
          name: "apps-console/source.sync",
          data: {
            workspaceId,
            workspaceKey,
            sourceId,
            sourceType: "github",
            syncMode: "full",
            trigger: "config-change",
            syncParams: {
              repoFullName,
              githubRepoId,
              githubInstallationId,
              branch,
              commitSha: afterSha,
              reason: "lightfast.yml modified",
            },
          },
        });

        log.info("Triggered full sync (config changed)", {
          sourceId,
          repoFullName,
        });
      });
    } else {
      // Normal push → trigger INCREMENTAL sync
      await step.run("trigger-incremental-sync", async () => {
        await inngest.send({
          name: "apps-console/source.sync",
          data: {
            workspaceId,
            workspaceKey,
            sourceId,
            sourceType: "github",
            syncMode: "incremental",
            trigger: "webhook",
            syncParams: {
              repoFullName,
              githubRepoId,
              githubInstallationId,
              branch,
              beforeSha,
              afterSha,
              deliveryId,
              headCommitTimestamp,
              changedFiles,
            },
          },
        });

        log.info("Triggered incremental sync (normal push)", {
          sourceId,
          repoFullName,
          changedCount: changedFiles.length,
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

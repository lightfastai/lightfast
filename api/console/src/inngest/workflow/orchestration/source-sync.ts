/**
 * Source Sync Orchestration Workflow
 *
 * Generic sync orchestrator for ANY source type.
 * Routes sync requests to provider-specific workflows.
 *
 * Triggered by:
 * - Manual restart (user clicks "Restart" on job)
 * - Scheduled syncs
 * - Config changes (e.g., lightfast.yml modified)
 * - source.connected workflow
 *
 * Routes to:
 * - GitHub → providers/github/sync.ts
 * - Linear → providers/linear/sync.ts (future)
 * - Notion → providers/notion/sync.ts (future)
 */

import { inngest } from "../../client/client";
import type { Events } from "../../client/client";
import { db } from "@db/console/client";
import { workspaces, workspaceSources } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { createJob, updateJobStatus } from "../../../lib/jobs";
import { log } from "@vendor/observability/log";
import { TRPCError } from "@trpc/server";

/**
 * Source Sync Orchestrator
 *
 * Provider-agnostic sync orchestration that:
 * 1. Validates source exists and is active
 * 2. Creates job record for tracking
 * 3. Routes to provider-specific sync workflow
 */
export const sourceSync = inngest.createFunction(
  {
    id: "apps-console/source-sync",
    name: "Source Sync",
    description: "Generic sync orchestrator for any source type",
    retries: 3,

    // Cancel if source is disconnected during sync
    cancelOn: [
      {
        event: "apps-console/source.disconnected",
        match: "data.sourceId",
      },
    ],
  },
  { event: "apps-console/source.sync" },
  async ({ event, step, runId }) => {
    const {
      workspaceId,
      workspaceKey,
      sourceId,
      sourceType,
      syncMode,
      trigger,
      syncParams,
    } = event.data;

    log.info("Source sync started", {
      workspaceId,
      sourceId,
      sourceType,
      syncMode,
      trigger,
    });

    // Step 1: Fetch and validate workspace source
    const sourceData = await step.run("fetch-source", async () => {
      const source = await db.query.workspaceSources.findFirst({
        where: eq(workspaceSources.id, sourceId),
      });

      if (!source) {
        throw new Error(`Workspace source not found: ${sourceId}`);
      }

      if (!source.isActive) {
        throw new Error(`Workspace source is inactive: ${sourceId}`);
      }

      // Verify sourceType matches
      if (source.sourceConfig.provider !== sourceType) {
        throw new Error(
          `Source type mismatch: expected ${sourceType}, got ${source.sourceConfig.provider}`
        );
      }

      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId),
      });

      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      return {
        source,
        workspace,
      };
    });

    // Step 2: Create job record
    const jobId = await step.run("create-job", async () => {
      let jobName = `${sourceType} Sync: ${syncMode}`;

      // Customize job name based on source type
      if (sourceType === "github" && sourceData.source.sourceConfig.provider === "github") {
        jobName = `GitHub Sync (${syncMode}): ${sourceData.source.sourceConfig.repoFullName}`;
      }

      return await createJob({
        clerkOrgId: sourceData.workspace.clerkOrgId,
        workspaceId,
        repositoryId: null, // Provider-specific workflows will link repository if needed
        inngestRunId: runId,
        inngestFunctionId: "source-sync",
        name: jobName,
        trigger: trigger === "manual" ? "manual" : "automatic",
        input: {
          sourceId,
          sourceType,
          syncMode,
          trigger,
          syncParams,
        },
      });
    });

    // Step 3: Update job to running
    await step.run("update-job-running", async () => {
      await updateJobStatus(jobId, "running");
    });

    // Step 4: Route to provider-specific sync workflow
    await step.run("route-to-provider", async () => {
      switch (sourceType) {
        case "github":
          // Trigger GitHub-specific sync
          await inngest.send({
            name: "apps-console/github.sync",
            data: {
              workspaceId,
              workspaceKey,
              sourceId,
              syncMode,
              trigger,
              jobId,
              syncParams: syncParams || {},
            },
          });
          break;

        case "linear":
          // TODO: Trigger Linear-specific sync
          throw new Error("Linear sync not yet implemented");

        case "notion":
          // TODO: Trigger Notion-specific sync
          throw new Error("Notion sync not yet implemented");

        case "sentry":
          // TODO: Trigger Sentry-specific sync
          throw new Error("Sentry sync not yet implemented");

        default:
          throw new Error(`Unsupported source type: ${sourceType}`);
      }

      log.info("Routed to provider sync", {
        sourceId,
        sourceType,
        syncMode,
        jobId,
      });
    });

    return {
      success: true,
      sourceId,
      sourceType,
      syncMode,
      jobId,
    };
  }
);

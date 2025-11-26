/**
 * Source Sync Orchestration Workflow (GitHub)
 *
 * Orchestrates GitHub repository syncs (full or incremental).
 * Routes sync requests to the GitHub provider workflow.
 *
 * Triggered by:
 * - Manual restart (user clicks "Restart" on job)
 * - Scheduled syncs
 * - Config changes (lightfast.yml modified)
 * - source.connected workflow (initial connection)
 * - GitHub push webhooks (incremental)
 *
 * Routes to: providers/github/sync.ts
 */

import { inngest } from "../../client/client";
import type { Events } from "../../client/client";
import { db } from "@db/console/client";
import { orgWorkspaces, workspaceIntegrations } from "@db/console/schema";
import type {
  SourceSyncGitHubInput,
  SourceSyncGitHubOutputSuccess,
  SourceSyncGitHubOutputFailure,
  GitHubSourceMetadata,
} from "@db/console/schema";
import { eq } from "drizzle-orm";
import { createJob, updateJobStatus, completeJob } from "../../../lib/jobs";
import { log } from "@vendor/observability/log";
import { TRPCError } from "@trpc/server";

/**
 * GitHub Source Sync Orchestrator
 *
 * GitHub-specific sync orchestration that:
 * 1. Validates GitHub source exists and is active
 * 2. Creates job record for tracking
 * 3. Routes to GitHub sync workflow
 */
export const sourceSync = inngest.createFunction(
  {
    id: "apps-console/source-sync",
    name: "GitHub Source Sync",
    description: "Orchestrates GitHub repository syncs (full or incremental)",
    retries: 3,

    // Cancel if source is disconnected during sync
    cancelOn: [
      {
        event: "apps-console/source.disconnected",
        match: "data.sourceId",
      },
    ],

    timeouts: {
      start: "2m",
      finish: "45m", // Increased to accommodate step.waitForEvent timeout
    },
  },
  { event: "apps-console/source.sync.github" },
  async ({ event, step, runId }) => {
    const {
      workspaceId,
      workspaceKey,
      sourceId,
      storeId,
      sourceType,
      syncMode,
      trigger,
      syncParams,
    } = event.data;

    log.info("Source sync started", {
      workspaceId,
      sourceId,
      storeId,
      sourceType,
      syncMode,
      trigger,
    });

    // Step 1: Fetch and validate workspace source
    const sourceData = await step.run("source.fetch", async () => {
      const source = await db.query.workspaceIntegrations.findFirst({
        where: eq(workspaceIntegrations.id, sourceId),
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

      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
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
    const jobId = await step.run("job.create", async () => {
      // Type narrow to GitHub source config
      if (sourceData.source.sourceConfig.provider !== "github") {
        throw new Error(`Expected GitHub source, got ${sourceData.source.sourceConfig.provider}`);
      }

      const jobName = `GitHub Sync (${syncMode}): ${sourceData.source.sourceConfig.repoFullName}`;

      const sourceMetadata: GitHubSourceMetadata = {
        repoId: sourceData.source.providerResourceId,
        repoFullName: sourceData.source.sourceConfig.repoFullName,
        defaultBranch: sourceData.source.sourceConfig.defaultBranch,
        installationId: sourceData.source.sourceConfig.installationId,
        isPrivate: sourceData.source.sourceConfig.isPrivate,
      };

      const input: SourceSyncGitHubInput = {
        inngestFunctionId: "source-sync",
        sourceId,
        sourceType: "github",
        sourceMetadata,
        syncMode,
        trigger,
        syncParams: syncParams || {},
      };

      return await createJob({
        clerkOrgId: sourceData.workspace.clerkOrgId,
        workspaceId,
        storeId,
        repositoryId: null, // Provider-specific workflows will link repository if needed
        inngestRunId: runId,
        inngestFunctionId: "source-sync",
        name: jobName,
        trigger: trigger === "manual" ? "manual" : "automatic",
        input,
      });
    });

    // Step 3: Update job to running
    await step.run("job.update-status", async () => {
      await updateJobStatus(jobId, "running");
    });

    // Step 4: Route to provider-specific sync workflow
    const eventIds = await step.sendEvent("sync.route-github", {
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

    await step.run("sync.log-dispatch", async () => {
      log.info("Routed to provider sync", {
        sourceId,
        sourceType,
        syncMode,
        jobId,
        eventId: eventIds.ids[0],
      });
    });

    // Step 5: Wait for provider sync to complete
    // This pauses the workflow until the provider emits a completion event
    const syncResult = await step.waitForEvent("sync.await-completion", {
      event: "apps-console/github.sync-completed",
      timeout: "40m", // Must be less than function finish timeout (45m)
      match: "data.sourceId",
      // The 'match' parameter automatically filters to events where
      // event.data.sourceId === this workflow's sourceId
    });

    // Step 6: Handle completion or timeout
    const finalStatus = await step.run("sync.finalize", async () => {
      // Type narrow to GitHub source config
      if (sourceData.source.sourceConfig.provider !== "github") {
        throw new Error(`Expected GitHub source, got ${sourceData.source.sourceConfig.provider}`);
      }

      if (syncResult === null) {
        // Timeout occurred - no completion event received within 40 minutes
        log.error("Provider sync timed out", {
          sourceId,
          sourceType,
          syncMode,
          jobId,
        });

        const output: SourceSyncGitHubOutputFailure = {
          inngestFunctionId: "source-sync",
          status: "failure",
          sourceId,
          sourceType: "github",
          repoFullName: sourceData.source.sourceConfig.repoFullName,
          syncMode,
          filesProcessed: 0,
          filesFailed: 0,
          timedOut: true,
          error: "Sync timed out after 40 minutes",
        };

        await completeJob({
          jobId,
          status: "failed",
          output,
        });

        return {
          success: false,
          timedOut: true,
          filesProcessed: 0,
          filesFailed: 0,
        };
      }

      // Sync completed successfully - syncResult contains the completion event data
      log.info("Provider sync completed", {
        sourceId,
        sourceType,
        filesProcessed: syncResult.data.filesProcessed,
        filesFailed: syncResult.data.filesFailed,
      });

      return {
        success: true,
        timedOut: false,
        filesProcessed: syncResult.data.filesProcessed,
        filesFailed: syncResult.data.filesFailed,
      };
    });

    // Step 7: Complete the source-sync job
    // IMPORTANT: source-sync creates its own job, so we need to complete it here
    await step.run("job.complete-source-sync", async () => {
      if (finalStatus.timedOut) {
        // Already completed with failure output above
        return;
      }

      // Type narrow to GitHub source config
      if (sourceData.source.sourceConfig.provider !== "github") {
        throw new Error(`Expected GitHub source, got ${sourceData.source.sourceConfig.provider}`);
      }

      const output: SourceSyncGitHubOutputSuccess = {
        inngestFunctionId: "source-sync",
        status: "success",
        sourceId,
        sourceType: "github",
        repoFullName: sourceData.source.sourceConfig.repoFullName,
        syncMode,
        filesProcessed: finalStatus.filesProcessed,
        filesFailed: finalStatus.filesFailed,
        timedOut: false,
      };

      await completeJob({
        jobId,
        status: "completed",
        output,
      });
    });

    // Update final return to include completion data
    return {
      success: finalStatus.success,
      sourceId,
      sourceType,
      syncMode,
      jobId,
      timedOut: finalStatus.timedOut,
      filesProcessed: finalStatus.filesProcessed,
      filesFailed: finalStatus.filesFailed,
    };
  }
);

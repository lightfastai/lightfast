/**
 * Source Connected Orchestration Workflow
 *
 * Generic orchestrator for when ANY source is connected to a workspace.
 * Routes to provider-specific sync workflows based on sourceType.
 *
 * Triggered by: User connecting a source via UI (GitHub, Linear, Notion, etc.)
 * Emits: apps-console/source.sync (routed to provider-specific sync)
 *
 * This replaces the old repository-initial-sync workflow with a
 * provider-agnostic orchestration layer.
 */

import { inngest } from "../../client/client";
import type { Events } from "../../client/client";
import { db } from "@db/console/client";
import { orgWorkspaces, workspaceIntegrations, workspaceStores } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { createJob, updateJobStatus, completeJob } from "../../../lib/jobs";
import { log } from "@vendor/observability/log";
import { getWorkspaceKey } from "@db/console/utils";

/**
 * Source Connected Handler
 *
 * High-level orchestrator that:
 * 1. Creates job record for tracking
 * 2. Validates source exists and is active
 * 3. Routes to provider-specific sync workflow
 */
export const sourceConnected = inngest.createFunction(
  {
    id: "apps-console/source-connected",
    name: "Source Connected",
    description: "Orchestrates initial sync when a source is connected to workspace",
    retries: 3,

    // Cancel if source is disconnected before sync completes
    cancelOn: [
      {
        event: "apps-console/source.disconnected",
        match: "data.sourceId",
      },
    ],

    timeouts: {
      start: "2m",
      finish: "50m", // Increased to accommodate source-sync completion wait
    },
  },
  { event: "apps-console/source.connected" },
  async ({ event, step, runId }) => {
    const {
      workspaceId,
      workspaceKey,
      sourceId,
      sourceType,
      sourceMetadata,
      trigger,
    } = event.data;

    log.info("Source connected", {
      workspaceId,
      sourceId,
      sourceType,
      trigger,
    });

    // Step 1: Fetch workspace and source metadata
    const metadata = await step.run("metadata.fetch", async () => {
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
      });

      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      const source = await db.query.workspaceIntegrations.findFirst({
        where: eq(workspaceIntegrations.id, sourceId),
      });

      if (!source) {
        throw new Error(`Workspace source not found: ${sourceId}`);
      }

      if (!source.isActive) {
        throw new Error(`Workspace source is inactive: ${sourceId}`);
      }

      // Resolve storeId from "default" store
      const store = await db.query.workspaceStores.findFirst({
        where: and(
          eq(workspaceStores.workspaceId, workspaceId),
          eq(workspaceStores.slug, "default")
        ),
      });

      if (!store) {
        throw new Error(`Default store not found for workspace: ${workspaceId}`);
      }

      return {
        clerkOrgId: workspace.clerkOrgId,
        workspace,
        source,
        storeId: store.id,
      };
    });

    // Step 2: Create job record
    const jobId = await step.run("job.create", async () => {
      const jobName = sourceType === "github"
        ? `GitHub Sync: ${(sourceMetadata as any).repoFullName || "Unknown"}`
        : `${sourceType} Sync`;

      return await createJob({
        clerkOrgId: metadata.clerkOrgId,
        workspaceId,
        storeId: metadata.storeId,
        repositoryId: null,
        inngestRunId: runId,
        inngestFunctionId: "source-connected",
        name: jobName,
        trigger: "automatic", // Initial connection is always automatic
        input: {
          sourceId,
          sourceType,
          sourceMetadata,
        },
      });
    });

    // Step 3: Update job to running
    await step.run("job.update-status", async () => {
      await updateJobStatus(jobId, "running");
    });

    // Step 4: Trigger provider-specific full sync
    const eventIds = await step.sendEvent("sync.trigger-provider", {
      name: "apps-console/source.sync",
      data: {
        workspaceId,
        workspaceKey,
        sourceId,
        storeId: metadata.storeId,
        sourceType,
        syncMode: "full",
        trigger: "config-change", // Initial connection = first-time config detection
        syncParams: sourceMetadata,
      },
    });

    await step.run("sync.log-dispatch", async () => {
      log.info("Triggered provider sync", {
        sourceId,
        sourceType,
        syncMode: "full",
        eventId: eventIds.ids[0],
      });
    });

    // Step 5: Wait for source sync to complete
    // CRITICAL: Don't complete job until sync actually finishes!
    const syncCompletion = await step.waitForEvent("sync.await-completion", {
      event: "apps-console/github.sync-completed",
      timeout: "45m",
      match: "data.sourceId",
    });

    // Step 6: Complete job with actual results (not premature completion)
    await step.run("job.complete", async () => {
      if (syncCompletion === null) {
        // Timeout - mark job as failed
        await completeJob({
          jobId,
          status: "failed",
          output: {
            sourceId,
            sourceType,
            syncTriggered: true,
            error: "Sync timed out after 45 minutes",
          },
        });
      } else {
        // Success - complete with actual processing results
        await completeJob({
          jobId,
          status: "completed",
          output: {
            sourceId,
            sourceType,
            syncTriggered: true,
            filesProcessed: syncCompletion.data.filesProcessed,
            storeSlug: syncCompletion.data.storeSlug,
          },
        });
      }
    });

    // Step 7: Return with actual results
    return {
      success: syncCompletion !== null,
      sourceId,
      sourceType,
      jobId,
      filesProcessed: syncCompletion?.data.filesProcessed ?? 0,
      filesFailed: syncCompletion?.data.filesFailed ?? 0,
      timedOut: syncCompletion === null,
    };
  }
);

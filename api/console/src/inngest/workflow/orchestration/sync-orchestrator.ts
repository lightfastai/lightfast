/**
 * Unified Sync Orchestrator (Source-Agnostic)
 *
 * This is the main orchestration point for ALL source syncs.
 * Handles common tasks then routes to source-specific orchestrators.
 *
 * Architecture:
 * 1. Create job for tracking
 * 2. Ensure store exists (step.invoke - blocks until complete)
 * 3. Validate auth/permissions
 * 4. Route to source-specific orchestrator
 * 5. Wait for source completion
 * 6. Update job with final metrics
 *
 * Supports: GitHub, Linear, Vercel, Notion, Slack, etc.
 */

import { inngest } from "../../client/client";
import type { Events } from "../../client/client";
import { db } from "@db/console/client";
import { orgWorkspaces, workspaceIntegrations } from "@db/console/schema";
import { eq } from "drizzle-orm";
import { createJob, updateJobStatus, completeJob } from "../../../lib/jobs";
import { log } from "@vendor/observability/log";
import { NonRetriableError } from "inngest";
import type { SourceType } from "@repo/console-validation";

/**
 * Type-safe event name constructors for dynamic routing
 * Uses canonical SourceType from validation schemas
 */
type _SyncTriggerEvent = `apps-console/${SourceType}.sync.trigger`;
type _SyncCompletedEvent = `apps-console/${SourceType}.sync.completed`;

/**
 * Unified Sync Orchestrator
 *
 * Source-agnostic orchestration that handles common tasks
 * then routes to source-specific orchestrators.
 */
export const syncOrchestrator = inngest.createFunction(
  {
    id: "apps-console/sync.orchestrator",
    name: "Sync Orchestrator - Unified Control",
    description: "Main orchestration point for all source syncs",
    retries: 3,

    // Only one sync per source at a time
    concurrency: {
      limit: 1,
      key: "event.data.sourceId",
    },

    // Cancel if source is disconnected
    cancelOn: [
      {
        event: "apps-console/source.disconnected",
        match: "data.sourceId",
      },
    ],

    // Handle failures gracefully
    onFailure: ({ event, error }) => {
      // event in onFailure is FailureEventPayload where data.event contains the original event
      const originalEvent = event.data.event;
      log.error("Sync orchestrator failed", {
        sourceId: originalEvent.data.sourceId,
        sourceType: originalEvent.data.sourceType,
        error: error.message,
      });
      // Note: jobId is not available in sync.requested event - it's created inside the orchestrator
    },

    timeouts: {
      start: "2m",
      finish: "30m", // Support large syncs
    },
  },
  { event: "apps-console/sync.requested" },
  async ({ event, step, logger }) => {
    const {
      workspaceId,
      workspaceKey,
      sourceId,
      sourceType,
      syncMode = "full",
      trigger = "manual",
      syncParams = {}
    } = event.data;

    logger.info("Unified sync orchestrator started", {
      workspaceId,
      sourceId,
      sourceType,
      syncMode,
      trigger,
    });

    // Runtime validation: Only GitHub is currently implemented
    if (sourceType !== "github") {
      throw new NonRetriableError(
        `Source type "${sourceType}" is not yet implemented. Only "github" is currently supported.`
      );
    }

    // Step 1: Fetch workspace and source metadata
    const metadata = await step.run("fetch-metadata", async () => {
      const ws = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
      });
      if (!ws) {
        throw new NonRetriableError(`Workspace not found: ${workspaceId}`);
      }

      const source = await db.query.workspaceIntegrations.findFirst({
        where: eq(workspaceIntegrations.id, sourceId),
      });
      if (!source) {
        throw new NonRetriableError(`Source not found: ${sourceId}`);
      }
      if (!source.isActive) {
        throw new NonRetriableError(`Source is inactive: ${sourceId}`);
      }

      return {
        workspace: ws,
        source,
        sourceConfig: source.sourceConfig,
      };
    });

    // Step 2: Create tracking job
    const jobId = await step.run("create-job", async () => {
      const runId = `sync-orchestrator-${Date.now()}`;
      return await createJob({
        clerkOrgId: metadata.workspace.clerkOrgId,
        workspaceId,
        repositoryId: null,
        inngestRunId: runId,
        inngestFunctionId: "sync.orchestrator",
        name: `Sync ${sourceType} source`,
        trigger: trigger === "manual" ? "manual" : "automatic",
        triggeredBy: null,
        input: {
          inngestFunctionId: "sync.orchestrator",
          sourceId,
          sourceType,
          syncMode,
        },
      });
    });

    // Step 3: Verify workspace has embedding config
    await step.run("verify-workspace-config", () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime safety: version may differ in future
      if (metadata.workspace.settings.version !== 1) {
        throw new NonRetriableError(
          `Workspace ${workspaceId} has invalid settings version.`
        );
      }
      logger.info("Workspace config verified", {
        indexName: metadata.workspace.settings.embedding.indexName,
        embeddingModel: metadata.workspace.settings.embedding.embeddingModel,
      });
    });

    // Step 4: Update job status to running
    await step.run("update-job-running", async () => {
      await updateJobStatus(jobId, "running");
    });

    // Step 5: Route to source-specific orchestrator
    await step.run("route-to-source", async () => {
      // TypeScript knows sourceType is "github" after runtime check
      const eventName = "apps-console/github.sync.trigger" as const;
      // Convert jobId to string for event (events expect string IDs)
      const eventData = {
        jobId: String(jobId),
        workspaceId,
        workspaceKey,
        sourceId,
        sourceConfig: metadata.sourceConfig,
        syncMode,
        syncParams,
      };

      logger.info("Routing to source-specific orchestrator", {
        sourceType,
        eventName,
      });

      // Send source-specific event
      await step.sendEvent("trigger-source-sync", {
        name: eventName,
        data: eventData,
      });

      return eventName;
    });

    // Step 6: Wait for source-specific completion
    const completionEvent = "apps-console/github.sync.completed" as const;
    const sourceResult = await step.waitForEvent("await-source-completion", {
      event: completionEvent,
      match: "data.jobId",
      timeout: "25m",
    });

    // Extract metrics from source completion
    const metrics = extractMetricsFromSource(sourceType, sourceResult?.data);

    logger.info("Source processing complete", {
      sourceType,
      ...metrics,
    });

    // Step 7: Update job with final metrics
    const finalStatus = await step.run("update-job-complete", async () => {
      await completeJob({
        jobId,
        status: sourceResult ? "completed" : "failed",
        output: sourceResult ? {
          inngestFunctionId: "sync.orchestrator" as const,
          status: "success" as const,
          sourceId,
          sourceType, // Now properly typed as "github" from sourceTypeSchema
          syncMode,
          itemsProcessed: metrics.itemsProcessed,
          itemsFailed: metrics.itemsFailed,
          embeddingsCreated: metrics.embeddingsCreated,
        } : {
          inngestFunctionId: "sync.orchestrator" as const,
          status: "failure" as const,
          sourceId,
          sourceType, // Now properly typed as "github" from sourceTypeSchema
          syncMode,
          itemsProcessed: metrics.itemsProcessed,
          itemsFailed: metrics.itemsFailed,
          embeddingsCreated: metrics.embeddingsCreated,
          error: "Sync failed - check logs for details",
        },
      });

      return metrics;
    });

    // Step 8: Update source sync status
    await step.run("update-source-status", async () => {
      await db
        .update(workspaceIntegrations)
        .set({
          lastSyncedAt: new Date().toISOString(),
          lastSyncStatus: sourceResult ? "success" : "failed",
        })
        .where(eq(workspaceIntegrations.id, sourceId));
    });

    // Step 9: Emit completion event for any parent workflows
    await step.sendEvent("sync-completed", {
      name: "apps-console/sync.completed",
      data: {
        sourceId,
        jobId: String(jobId),  // Convert to string for event
        success: !!sourceResult,
        syncMode,
        filesProcessed: metrics.itemsProcessed,
        filesFailed: metrics.itemsFailed,
        embeddingsCreated: metrics.embeddingsCreated,
      },
    });

    logger.info("Sync completed", {
      jobId,
      sourceType,
      success: !!sourceResult,
      ...metrics,
    });

    return {
      success: !!sourceResult,
      jobId,
      stats: finalStatus,
    };
  }
);

/**
 * Type for source-specific completion event data
 * Currently only GitHub is implemented
 */
type SourceCompletionData = Events["apps-console/github.sync.completed"]["data"];

/**
 * Extract metrics from source-specific completion events
 */
function extractMetricsFromSource(
  sourceType: SourceType,
  data: SourceCompletionData | undefined
) {
  if (!data) {
    return {
      itemsProcessed: 0,
      itemsFailed: 0,
      embeddingsCreated: 0,
    };
  }

  // Currently only GitHub is implemented
  if (sourceType === "github") {
    return {
      itemsProcessed: data.filesProcessed,
      itemsFailed: data.filesFailed,
      embeddingsCreated: data.filesProcessed, // Approximation
    };
  }

  // Default for future sources
  return {
    itemsProcessed: 0,
    itemsFailed: 0,
    embeddingsCreated: 0,
  };
}
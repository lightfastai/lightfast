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
import { orgWorkspaces, workspaceIntegrations } from "@db/console/schema";
import { eq } from "drizzle-orm";
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
    const metadata = await step.run("fetch-metadata", async () => {
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

      return {
        clerkOrgId: workspace.clerkOrgId,
        workspace,
        source,
      };
    });

    // Step 2: Create job record
    const jobId = await step.run("create-job", async () => {
      const jobName = sourceType === "github"
        ? `GitHub Sync: ${(sourceMetadata as any).repoFullName || "Unknown"}`
        : `${sourceType} Sync`;

      return await createJob({
        clerkOrgId: metadata.clerkOrgId,
        workspaceId,
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
    await step.run("update-job-running", async () => {
      await updateJobStatus(jobId, "running");
    });

    // Step 4: Trigger provider-specific full sync
    await step.run("trigger-provider-sync", async () => {
      await inngest.send({
        name: "apps-console/source.sync",
        data: {
          workspaceId,
          workspaceKey,
          sourceId,
          sourceType,
          syncMode: "full",
          trigger: "config-change", // Initial connection = first-time config detection
          syncParams: sourceMetadata,
        },
      });

      log.info("Triggered provider sync", {
        sourceId,
        sourceType,
        syncMode: "full",
      });
    });

    // Step 5: Complete job
    await step.run("complete-job", async () => {
      await completeJob({
        jobId,
        status: "completed",
        output: {
          sourceId,
          sourceType,
          syncTriggered: true,
        },
      });
    });

    return {
      success: true,
      sourceId,
      sourceType,
      jobId,
    };
  }
);

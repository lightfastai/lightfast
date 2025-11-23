/**
 * Repository Initial Sync Workflow
 *
 * Triggered when a repository is first connected to a workspace.
 * Performs initial indexing and setup.
 *
 * Workflow:
 * 1. Ensure store exists for workspace
 * 2. Fetch repository configuration (lightfast.yml)
 * 3. Trigger document ingestion for default branch
 * 4. Update workspace integration sync status
 */

import { inngest } from "../client/client";
import { db } from "@db/console/client";
import {
  workspaceSources,
  userSources,
} from "@db/console/schema";
import { eq } from "drizzle-orm";
import { createJob, updateJobStatus, completeJob, recordJobMetric } from "../../lib/jobs";

/**
 * Repository Initial Sync Function
 *
 * Coordinates the initial sync when a repository is connected.
 * This function orchestrates:
 * - Store provisioning
 * - Configuration detection
 * - Initial document ingestion
 * - Status tracking
 */
export const repositoryInitialSync = inngest.createFunction(
  {
    id: "repository-initial-sync",
    name: "Repository Initial Sync",
    cancelOn: [
      // Cancel if repository is disconnected before sync completes
      {
        event: "apps-console/repository.disconnected",
        match: "data.resourceId",
      },
    ],
    retries: 3,
  },
  { event: "apps-console/repository.connected" },
  async ({ event, step, runId }) => {
    const {
      workspaceId,
      workspaceKey,
      resourceId,
      repoFullName,
      defaultBranch,
      installationId,
      integrationId,
      isPrivate,
    } = event.data;

    // Step 0: Create job record for tracking
    const jobId = await step.run("create-job", async () => {
      // Get workspace to retrieve clerkOrgId
      const workspace = await db.query.workspaces.findFirst({
        where: (workspaces, { eq }) => eq(workspaces.id, workspaceId),
      });

      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      // Find repository ID from workspaceSources
      let repositoryId: string | null = null;

      const workspaceSource = await db.query.workspaceSources.findFirst({
        where: eq(workspaceSources.id, resourceId),
      });

      if (workspaceSource?.sourceConfig && workspaceSource.sourceConfig.provider === "github") {
        const githubData = workspaceSource.sourceConfig;
        const repo = await db.query.DeusConnectedRepository.findFirst({
          where: (repos, { eq }) => eq(repos.githubRepoId, String(githubData.repoId)),
        });
        repositoryId = repo?.id ?? null;
      }

      return await createJob({
        clerkOrgId: workspace.clerkOrgId,
        workspaceId,
        repositoryId,
        inngestRunId: runId,
        inngestFunctionId: "repository-initial-sync",
        name: `Repository Initial Sync: ${repoFullName}`,
        trigger: "automatic",
        input: {
          repoFullName,
          resourceId,
          defaultBranch,
          isPrivate,
        },
      });
    });

    // Update job to running status
    await step.run("update-job-running", async () => {
      await updateJobStatus(jobId, "running");
    });

    // Step 1: Ensure store exists for this workspace
    const storeSlug = await step.run("ensure-store", async () => {
      // For now, use a default store slug based on workspace
      // In Phase 2, this could be configured per-workspace
      const slug = "default";

      // Trigger store provisioning
      await inngest.send({
        name: "apps-console/store.ensure",
        data: {
          workspaceId,
          workspaceKey,
          storeSlug: slug,
          repoFullName,
        },
      });

      return slug;
    });

    // Step 2: Update workspace source sync status
    await step.run("update-sync-status-started", async () => {
      await db
        .update(workspaceSources)
        .set({
          lastSyncStatus: "in_progress",
        })
        .where(eq(workspaceSources.id, resourceId));
    });

    // Step 3: Fetch repository metadata
    const repoMetadata = await step.run("fetch-repo-metadata", async () => {
      const wsSource = await db.query.workspaceSources.findFirst({
        where: eq(workspaceSources.id, resourceId),
      });

      if (!wsSource) {
        throw new Error(`Resource not found: ${resourceId}`);
      }

      // Metadata already available in workspaceSources
      return {
        fullName: repoFullName,
        defaultBranch,
        isPrivate,
      };
    });

    // Step 4: Trigger initial document ingestion
    // This will process all files in the default branch according to lightfast.yml
    await step.run("trigger-initial-ingestion", async () => {
      const wsSource = await db.query.workspaceSources.findFirst({
        where: eq(workspaceSources.id, resourceId),
      });

      if (!wsSource?.sourceConfig || wsSource.sourceConfig.provider !== "github") {
        throw new Error("Invalid GitHub resource");
      }

      const githubData = {
        repoId: wsSource.sourceConfig.repoId,
        installationId: wsSource.sourceConfig.installationId,
      };

      // Trigger docs ingestion workflow
      // This workflow will:
      // 1. Fetch lightfast.yml config
      // 2. List all files in default branch
      // 3. Filter files according to config
      // 4. Process each file (chunk, embed, index)
      await inngest.send({
        name: "apps-console/docs.push",
        data: {
          workspaceId,
          workspaceKey,
          repoFullName,
          githubRepoId: Number(githubData.repoId),
          githubInstallationId: Number(githubData.installationId),
          beforeSha: "0000000000000000000000000000000000000000", // Initial sync
          afterSha: "HEAD", // Will resolve to latest commit on default branch
          deliveryId: `initial-sync-${resourceId}`,
          source: "manual",
          changedFiles: [], // Empty = process all files
        },
      });
    });

    // Step 5: Update final status
    await step.run("update-sync-status-completed", async () => {
      await db
        .update(workspaceSources)
        .set({
          lastSyncedAt: new Date(),
          lastSyncStatus: "completed",
        })
        .where(eq(workspaceSources.id, resourceId));
    });

    // Step 6: Complete job successfully
    await step.run("complete-job", async () => {
      await completeJob({
        jobId,
        status: "completed",
        output: {
          repoFullName,
          resourceId,
          storeSlug,
        },
      });
    });

    return {
      success: true,
      workspaceId,
      resourceId,
      repoFullName,
      storeSlug,
    };
  }
);

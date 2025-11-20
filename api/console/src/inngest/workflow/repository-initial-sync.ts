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
import { workspaceIntegrations, integrationResources } from "@db/console/schema";
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

      // Find repository ID
      let repositoryId: string | null = null;
      const resource = await db.query.integrationResources.findFirst({
        where: eq(integrationResources.id, resourceId),
      });

      if (resource?.resourceData && resource.resourceData.provider === "github") {
        const githubData = resource.resourceData;
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

    // Step 2: Update workspace integration status
    await step.run("update-sync-status-started", async () => {
      await db
        .update(workspaceIntegrations)
        .set({
          lastSyncStatus: "in_progress",
        })
        .where(eq(workspaceIntegrations.resourceId, resourceId));
    });

    // Step 3: Fetch repository metadata from GitHub
    const repoMetadata = await step.run("fetch-repo-metadata", async () => {
      // Get integration to access installation credentials
      const resource = await db.query.integrationResources.findFirst({
        where: eq(integrationResources.id, resourceId),
        with: {
          integration: true,
        },
      });

      if (!resource) {
        throw new Error(`Integration resource not found: ${resourceId}`);
      }

      // For now, return basic metadata
      // In a full implementation, you would:
      // 1. Get installation token from GitHub App
      // 2. Fetch repository details via GitHub API
      // 3. Detect languages, frameworks, etc.
      return {
        fullName: repoFullName,
        defaultBranch,
        isPrivate,
      };
    });

    // Step 4: Trigger initial document ingestion
    // This will process all files in the default branch according to lightfast.yml
    await step.run("trigger-initial-ingestion", async () => {
      // Get integration resource to access GitHub installation ID
      const resource = await db.query.integrationResources.findFirst({
        where: eq(integrationResources.id, resourceId),
      });

      if (!resource?.resourceData || resource.resourceData.provider !== "github") {
        throw new Error("Invalid GitHub resource");
      }

      const githubData = resource.resourceData;

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
        .update(workspaceIntegrations)
        .set({
          lastSyncedAt: new Date(),
          lastSyncStatus: "completed",
          lastSyncError: null,
        })
        .where(eq(workspaceIntegrations.resourceId, resourceId));
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

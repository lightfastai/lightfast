/**
 * Main docs ingestion workflow
 *
 * Triggered by GitHub push webhook. Processes changed files according to
 * lightfast.yml configuration.
 *
 * Workflow steps:
 * 1. Load lightfast.yml from repository
 * 2. Ensure store exists (via separate ensure-store workflow)
 * 3. Check idempotency (has this delivery been processed?)
 * 4. Filter changed files by config globs
 * 5. For each file: trigger process or delete workflow
 * 6. Record event in ingestion_events table
 */

import { db } from "@db/console/client";
import { ingestionEvents } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "../client/client";
import type { Events } from "../client/client";
import { log } from "@vendor/observability/log";
import { resolveEmbeddingDefaults } from "@repo/console-embed";
import { ensureStore } from "./ensure-store";
import {
  createGitHubApp,
  getThrottledInstallationOctokit,
  GitHubContentService,
} from "@repo/console-octokit-github";
import { validateConfig, PRIVATE_CONFIG } from "@repo/console-config";
import { env } from "../../env";
import yaml from "yaml";
import { minimatch } from "minimatch";
import { createHash } from "node:crypto";
import { createJob, updateJobStatus, completeJob, recordJobMetric } from "../../lib/jobs";

type DispatchAction = "process" | "delete";

// Inngest requires deterministic, URL-safe IDs per step/event so retries can resume
// without re-running earlier work. We hash file metadata into a short token to keep
// IDs stable and readable without worrying about path length or characters.
// TODO: re-evaluate using GitHub's file/blob hash directly once it is exposed in the event payload.
const hashToken = (value: string): string =>
  createHash("sha1").update(value).digest("hex").slice(0, 12);

/**
 * Main docs ingestion function
 *
 * Orchestrates processing of a GitHub push event. Ensures idempotency
 * and delegates individual file processing to child workflows.
 */
export const docsIngestion = inngest.createFunction(
  {
    id: "apps-console/docs-ingestion",
    name: "Docs Ingestion",
    description: "Orchestrates document ingestion from GitHub push webhooks",
    retries: PRIVATE_CONFIG.workflow.retries,

    // Prevent duplicate processing of same webhook delivery
    idempotency: "event.data.deliveryId",

    // Only process one push per repo at a time (prevent concurrent ingestion)
    singleton: {
      key: "event.data.repoFullName",
      mode: "skip", // Skip if already processing this repo
    },

    // Timeout for GitHub API calls + file processing triggers
    timeouts: {
      start: "2m", // Max queue time
      finish: "15m", // Config load + file processing triggers
    },
  },
  { event: "apps-console/docs.push" },
  async ({ event, step, runId }) => {
    const {
      workspaceId,
      workspaceKey,
      repoFullName,
      githubRepoId,
      githubInstallationId,
      beforeSha,
      afterSha,
      deliveryId,
      source,
      headCommitTimestamp,
      changedFiles,
    } = event.data;

    const commitTimestamp = headCommitTimestamp ?? new Date().toISOString();
    let targetStore: { id: string; name: string } | null = null;

    const { dimension: targetEmbeddingDim } = resolveEmbeddingDefaults();

    log.info("Starting docs ingestion", {
      workspaceId,
      repoFullName,
      deliveryId,
      changedCount: changedFiles.length,
    });

    // Step 0: Create job record for tracking
    const jobId = await step.run("create-job", async () => {
      // Get workspace to retrieve clerkOrgId
      const workspace = await db.query.workspaces.findFirst({
        where: (workspaces, { eq }) => eq(workspaces.id, workspaceId),
      });

      if (!workspace) {
        throw new Error(`Workspace not found: ${workspaceId}`);
      }

      // Find repository ID if we have the GitHub repo ID
      let repositoryId: string | null = null;
      if (githubRepoId) {
        const repo = await db.query.DeusConnectedRepository.findFirst({
          where: (repos, { eq }) => eq(repos.githubRepoId, String(githubRepoId)),
        });
        repositoryId = repo?.id ?? null;
      }

      const trigger = source === "manual" ? "manual" : source === "scheduled" ? "scheduled" : "webhook";

      return await createJob({
        clerkOrgId: workspace.clerkOrgId,
        workspaceId,
        repositoryId,
        inngestRunId: runId,
        inngestFunctionId: "apps-console/docs-ingestion",
        name: `Docs Ingestion: ${repoFullName}`,
        trigger,
        input: {
          repoFullName,
          deliveryId,
          changedFileCount: changedFiles.length,
        },
      });
    });

    // Update job to running status
    await step.run("update-job-running", async () => {
      await updateJobStatus(jobId, "running");
    });

    // Step 1: Load lightfast.yml from repository (before idempotency to honor configured store name)
    const configPatterns = await step.run("load-config", async () => {
      log.info("Loading lightfast.yml from repository", {
        repoFullName,
        ref: afterSha,
      });

      // Create GitHub App and get installation Octokit
      const app = createGitHubApp({
        appId: env.GITHUB_APP_ID,
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      });

      const octokit = await getThrottledInstallationOctokit(
        app,
        githubInstallationId,
      );

      // Create content service and fetch lightfast.yml (try common variants)
      const contentService = new GitHubContentService(octokit);
      const [owner, repo] = repoFullName.split("/");

      if (!owner || !repo) {
        throw new Error(`Invalid repository full name: ${repoFullName}`);
      }

      const repoOwner = owner;
      const repoName = repo;

      async function fetchConfigFile() {
        const candidates = [
          "lightfast.yml",
          ".lightfast.yml",
          "lightfast.yaml",
          ".lightfast.yaml",
        ];
        for (const path of candidates) {
          const file = await contentService.fetchSingleFile(
            repoOwner,
            repoName,
            path,
            afterSha,
          );
          if (file) return file;
        }
        return null;
      }

      const configFile = await fetchConfigFile();

      if (!configFile) {
        throw new Error(
          `No lightfast.yml configuration found in repository ${repoFullName}. ` +
            `Please add a lightfast.yml file to the root of your repository. ` +
            `See https://docs.lightfast.ai/configuration for details.`,
        );
      }

      // Parse config (parse YAML then validate)
      const parsed = yaml.parse(configFile.content);
      const configResult = validateConfig(parsed);

      if (configResult.isErr()) {
        throw new Error(
          `Invalid lightfast.yml configuration in repository ${repoFullName}: ${configResult.error}. ` +
            `See https://docs.lightfast.ai/configuration for details.`,
        );
      }

      const config = configResult.value;

      log.info("Loaded lightfast.yml config", {
        store: config.store,
        globs: config.include,
      });

      return {
        globs: config.include,
        store: config.store,
      };
    });

    // Use configured store name, fallback to 'docs' if not specified in config
    const effectiveStoreName =
      (configPatterns as { store?: string }).store ?? "docs";

    // Step 2: Ensure store exists (separate workflow for idempotency and clarity)
    const storeResult = await step.invoke("ensure-store", {
      function: ensureStore,
      data: {
        workspaceId,
        workspaceKey,
        storeSlug: effectiveStoreName,
        embeddingDim: targetEmbeddingDim,
        githubRepoId,
        repoFullName,
      },
    });

    const store = storeResult.store;
    targetStore = {
      id: store.id,
      name: store.slug,
    };

    log.info("Store ensured", {
      storeId: store.id,
      status: storeResult.status,
      created: storeResult.created,
    });

    // Step 3: Check idempotency - has this delivery already been processed?
    const existingEvent = await step.run("check-idempotency", async () => {
      try {
        // Check if we've already processed this delivery
        // Use deliveryId for webhook idempotency (not afterSha to allow re-processing)
        const existing = await db.query.ingestionEvents.findFirst({
          where: and(
            eq(ingestionEvents.storeId, store.id),
            eq(ingestionEvents.sourceType, "github"),
            eq(ingestionEvents.eventKey, deliveryId),
          ),
        });

        return existing ?? null;
      } catch (error) {
        log.error("Failed to check idempotency", { error, deliveryId });
        throw error;
      }
    });

    if (existingEvent) {
      log.info("Delivery already processed, skipping", {
        deliveryId,
        processedAt: existingEvent.processedAt,
      });

      // Complete job as cancelled since delivery was already processed
      await step.run("complete-job-skipped", async () => {
        await completeJob({
          jobId,
          status: "cancelled",
          output: {
            reason: "already_processed",
          },
        });
      });

      return { status: "skipped", reason: "already_processed" };
    }

    // Step 4: Filter changed files by config globs
    const filteredFiles = await step.run("filter-files", async () => {
      const filtered = changedFiles.filter(
        (file: { path: string; status: string }) => {
          return configPatterns.globs.some((glob: string) =>
            minimatch(file.path, glob),
          );
        },
      );

      log.info("Filtered files", {
        total: changedFiles.length,
        matched: filtered.length,
        globs: configPatterns.globs,
      });

      return filtered;
    });

    if (filteredFiles.length === 0) {
      log.info("No matching files to process", { deliveryId });

      // Record as processed with skipped status
      await step.run("record-skip", async () => {
        if (!targetStore) {
          log.warn("Cannot record skip - store context missing");
          return;
        }

        await db
          .insert(ingestionEvents)
          .values({
            id: `${targetStore.id}_${deliveryId}`,
            storeId: targetStore.id,
            sourceType: "github",
            eventKey: deliveryId,
            eventMetadata: {
              beforeSha,
              afterSha,
              repoFullName,
              changedFileCount: 0,
            },
            source: source as "webhook" | "backfill" | "manual" | "api",
            status: "skipped",
          })
          .onConflictDoNothing({
            target: [
              ingestionEvents.storeId,
              ingestionEvents.sourceType,
              ingestionEvents.eventKey,
            ],
          });
      });

      // Complete job as completed with 0 documents processed
      await step.run("complete-job-no-files", async () => {
        await completeJob({
          jobId,
          status: "completed",
          output: {
            documentsProcessed: 0,
            totalFilesProcessed: 0,
            reason: "no_matching_files",
          },
        });
      });

      return { status: "skipped", reason: "no_matching_files" };
    }

    // Step 5: Trigger process or delete workflows for each file
    const processResults: Array<{
      path: string;
      action: string;
      status: string;
    }> = [];

    const batchSize = Math.max(1, PRIVATE_CONFIG.github.ingestFileBatchSize);
    const dispatchConcurrency = Math.max(
      1,
      PRIVATE_CONFIG.github.fetchConcurrency,
    );
    let globalIndex = 0;

    const dispatchFile = async (
      file: { path: string; status: string },
      index: number,
    ): Promise<{ path: string; action: DispatchAction; status: string }> => {
      const action: DispatchAction =
        file.status === "removed" ? "delete" : "process";
      const pathFingerprint = hashToken(
        `${workspaceId}:${effectiveStoreName}:${file.path}`,
      );
      const stepId = `dispatch-${action}-${index}-${pathFingerprint}`;
      const eventId = `docs.${action}:${pathFingerprint}:${deliveryId}`;

      try {
        if (action === "delete") {
          await step.sendEvent(stepId, {
            id: eventId,
            name: "apps-console/docs.file.delete",
            data: {
              workspaceId,
              storeSlug: effectiveStoreName,
              repoFullName,
              filePath: file.path,
            },
          });
        } else {
          await step.sendEvent(stepId, {
            id: eventId,
            name: "apps-console/docs.file.process",
            data: {
              workspaceId,
              storeSlug: effectiveStoreName,
              repoFullName,
              githubInstallationId,
              filePath: file.path,
              commitSha: afterSha,
              committedAt: commitTimestamp,
            },
          });
        }

        return {
          path: file.path,
          action,
          status: "queued",
        };
      } catch (error) {
        log.error("Failed to trigger workflow", {
          path: file.path,
          stepId,
          error,
        });
        return {
          path: file.path,
          action,
          status: "failed",
        };
      }
    };

    for (let offset = 0; offset < filteredFiles.length; offset += batchSize) {
      const fileBatch = filteredFiles.slice(offset, offset + batchSize);

      for (
        let cursor = 0;
        cursor < fileBatch.length;
        cursor += dispatchConcurrency
      ) {
        const group = fileBatch.slice(cursor, cursor + dispatchConcurrency);
        const groupResults = await Promise.all(
          group.map((file) => dispatchFile(file, globalIndex++)),
        );
        processResults.push(...groupResults);
      }
    }

    log.info("Triggered file workflows", {
      total: filteredFiles.length,
      results: processResults,
    });

    // Step 6: Record event as processed
    await step.run("record-event", async () => {
      try {
        if (!targetStore) {
          log.error("Cannot record event - store context missing");
          return;
        }

        await db
          .insert(ingestionEvents)
          .values({
            id: `${targetStore.id}_${deliveryId}`,
            storeId: targetStore.id,
            sourceType: "github",
            eventKey: deliveryId,
            eventMetadata: {
              beforeSha,
              afterSha,
              repoFullName,
              changedFileCount: filteredFiles.length,
              processedFileCount: processResults.filter((r) => r.status === "queued")
                .length,
            },
            source: source as "webhook" | "backfill" | "manual" | "api",
            status: "processed",
          })
          .onConflictDoNothing({
            target: [
              ingestionEvents.storeId,
              ingestionEvents.sourceType,
              ingestionEvents.eventKey,
            ],
          });

        log.info("Recorded event", {
          storeId: targetStore.id,
          deliveryId,
        });
      } catch (error) {
        log.error("Failed to record event", { error, deliveryId });
        throw error;
      }
    });

    // Step 7: Complete job successfully
    await step.run("complete-job", async () => {
      await completeJob({
        jobId,
        status: "completed",
        output: {
          documentsProcessed: processResults.filter((r) => r.status === "queued").length,
          totalFilesProcessed: filteredFiles.length,
          totalChangedFiles: changedFiles.length,
        },
      });

      // Record documents indexed metric
      const workspace = await db.query.workspaces.findFirst({
        where: (workspaces, { eq }) => eq(workspaces.id, workspaceId),
      });

      if (workspace) {
        await recordJobMetric({
          clerkOrgId: workspace.clerkOrgId,
          workspaceId,
          type: "documents_indexed",
          value: processResults.filter((r) => r.status === "queued").length,
          unit: "count",
          tags: {
            repoFullName,
            source,
          },
        });
      }
    });

    return {
      status: "processed",
      filesProcessed: filteredFiles.length,
      results: processResults,
    };
  },
);

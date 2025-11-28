/**
 * File Batch Processor
 *
 * Processes a batch of files and emits completion events with real counts.
 * Part of the new orchestrated architecture - no more fire-and-forget!
 *
 * This workflow:
 * 1. Receives a batch of files from sync.orchestrator
 * 2. Fetches content from GitHub
 * 3. Transforms to generic document format
 * 4. Sends to document processor
 * 5. Emits completion event with real counts
 */

import { inngest } from "../../client/client";
import type { Events } from "../../client/client";
import { log } from "@vendor/observability/log";
import {
  createGitHubApp,
  getThrottledInstallationOctokit,
  GitHubContentService,
} from "@repo/console-octokit-github";
import { env } from "../../../env";
import { createHash } from "node:crypto";

/**
 * Generate document ID from repository and file path
 */
function generateDocumentId(repoFullName: string, filePath: string): string {
  return `github:${repoFullName}:${filePath}`;
}

/**
 * Generate content hash for a file
 */
function generateContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * File Batch Processor
 *
 * Processes files in batches and emits completion events.
 * This enables accurate tracking in the orchestrator.
 */
export const filesBatchProcessor = inngest.createFunction(
  {
    id: "apps-console/files.batch.processor",
    name: "Process File Batch",
    description: "Process a batch of files and emit completion event",
    retries: 3,

    // Process up to 10 batches in parallel
    concurrency: {
      limit: 10,
      key: "event.data.workspaceId",
    },

    timeouts: {
      start: "30s",
      finish: "5m",
    },
  },
  { event: "apps-console/files.batch.process" },
  async ({ event, step }) => {
    const {
      batchId,
      workspaceId,
      sourceId,
      storeId,
      storeSlug,
      files,
      githubInstallationId,
      repoFullName,
      commitSha,
      committedAt,
    } = event.data;

    const startTime = Date.now();

    log.info("Processing file batch", {
      batchId,
      fileCount: files.length,
      repoFullName,
    });

    // Track results
    const results = {
      processed: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Step 1: Process deletions
    const deletions = files.filter(file => file.status === "removed");
    if (deletions.length > 0) {
      await step.run("process-deletions", async () => {
        const deleteEvents = deletions.map(file => ({
          name: "apps-console/documents.delete" as const,
          data: {
            workspaceId,
            storeSlug,
            documentId: generateDocumentId(repoFullName, file.path),
            sourceType: "github" as const,
            sourceId: file.path,
          },
        }));

        await step.sendEvent("delete-documents", deleteEvents);

        log.info("Sent deletion events", {
          count: deletions.length,
        });

        results.processed += deletions.length;
      });
    }

    // Step 2: Process additions/modifications
    const toFetch = files.filter(file => file.status !== "removed");

    if (toFetch.length > 0) {
      const processResults = await step.run("fetch-and-process", async () => {
        // Create GitHub app and service
        const app = createGitHubApp({
          appId: env.GITHUB_APP_ID,
          privateKey: env.GITHUB_APP_PRIVATE_KEY,
        });

        const octokit = await getThrottledInstallationOctokit(
          app,
          githubInstallationId
        );

        const contentService = new GitHubContentService(octokit);
        const [owner, repo] = repoFullName.split("/");

        if (!owner || !repo) {
          throw new Error(`Invalid repository name: ${repoFullName}`);
        }

        // Fetch all file contents in parallel
        const fetchResults = await Promise.allSettled(
          toFetch.map(async (file) => {
            try {
              // Use the commit SHA if provided, otherwise use "HEAD" for default branch
              const content = await contentService.fetchSingleFile(
                owner,
                repo,
                file.path,
                commitSha === "HEAD" ? "HEAD" : commitSha
              );

              if (!content) {
                throw new Error(`File not found: ${file.path}`);
              }

              return {
                success: true,
                file: file.path,
                content: content.content || "",
                title: file.path.split("/").pop() || file.path,
              };
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : "Unknown error";
              log.error("Failed to fetch file", {
                file: file.path,
                error: errorMessage,
              });
              return {
                success: false,
                file: file.path,
                error: errorMessage,
              };
            }
          })
        );

        // Process successful fetches
        const documentsToProcess: any[] = [];

        fetchResults.forEach((result) => {
          if (result.status === "fulfilled") {
            if (result.value.success && result.value.content) {
              const contentHash = generateContentHash(result.value.content);
              const documentId = generateDocumentId(repoFullName, result.value.file);

              documentsToProcess.push({
                name: "apps-console/documents.process" as const,
                data: {
                  workspaceId,
                  storeSlug,
                  documentId,
                  sourceType: "github" as const,
                  sourceId: result.value.file,
                  sourceMetadata: {
                    repoFullName,
                    filePath: result.value.file,
                    commitSha,
                    committedAt,
                  },
                  title: result.value.title,
                  content: result.value.content,
                  contentHash,
                },
              });
            } else {
              results.errors.push(result.value.error || "Unknown error");
            }
          } else {
            results.errors.push(result.reason?.message || "Unknown error");
          }
        });

        // Send documents for processing
        if (documentsToProcess.length > 0) {
          await step.sendEvent("process-documents", documentsToProcess);

          log.info("Sent documents for processing", {
            count: documentsToProcess.length,
          });
        }

        return {
          fetched: documentsToProcess.length,
          failed: fetchResults.length - documentsToProcess.length,
        };
      });

      results.processed += processResults.fetched;
      results.failed += processResults.failed;
    }

    const durationMs = Date.now() - startTime;

    // Step 3: Emit completion event with real counts
    await step.sendEvent("batch-complete", {
      name: "apps-console/files.batch.completed",
      data: {
        batchId,
        success: results.failed === 0,
        processed: results.processed,
        failed: results.failed,
        durationMs,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
    });

    log.info("File batch processing complete", {
      batchId,
      processed: results.processed,
      failed: results.failed,
      durationMs,
    });

    return results;
  }
);
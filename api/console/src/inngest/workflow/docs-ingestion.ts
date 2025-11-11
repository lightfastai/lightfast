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
 * 6. Record commit in ingestion_commits table
 */

import { db } from "@db/console/client";
import { ingestionCommits } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "../client/client";
import type { Events } from "../client/client";
import { log } from "@vendor/observability/log";
import { resolveEmbeddingDefaults } from "@repo/console-embed";
import { ensureStore } from "./ensure-store";

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
    retries: 3,
  },
  { event: "apps-console/docs.push" },
  async ({ event, step }) => {
    const {
      workspaceId,
      workspaceKey,
      repoFullName,
      githubRepoId,
      githubInstallationId,
      beforeSha,
      afterSha,
      deliveryId,
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

    // Step 1: Load lightfast.yml from repository (before idempotency to honor configured store name)
    const configPatterns = await step.run("load-config", async () => {
      try {
        // Import GitHub utilities
        const {
          createGitHubApp,
          getThrottledInstallationOctokit,
          GitHubContentService,
        } = await import("@repo/console-octokit-github");
        const { loadConfig } = await import("@repo/console-config");
        const { env } = await import("../../env");

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
          log.warn(
            "No lightfast config found in repository, using default patterns",
          );
          return {
            // Broaden defaults to include common docs locations and README
            globs: ["docs/**/*.md", "docs/**/*.mdx", "README.md"],
          };
        }

        // Parse config (parse YAML then validate)
        const yaml = await import("yaml");
        const { validateConfig } = await import("@repo/console-config");

        const parsed = yaml.parse(configFile.content);
        const configResult = validateConfig(parsed);

        if (configResult.isErr()) {
          log.error("Invalid lightfast.yml config", {
            error: configResult.error,
          });
          return {
            globs: ["docs/**/*.md", "docs/**/*.mdx", "README.md"],
          };
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
      } catch (error) {
        log.error("Failed to load config, using defaults", { error });
        return {
          globs: ["docs/**/*.md", "docs/**/*.mdx", "README.md"],
        };
      }
    });

    // Use configured store name if available; fallback to 'docs' when no config
    const effectiveStoreName =
      (configPatterns as { store?: string }).store ?? "docs";

    // Step 2: Ensure store exists (separate workflow for idempotency and clarity)
    const storeResult = await step.invoke("ensure-store", {
      function: ensureStore,
      data: {
        workspaceId,
        workspaceKey,
        storeName: effectiveStoreName,
        embeddingDim: targetEmbeddingDim,
        githubRepoId,
        repoFullName,
      },
    });

    const store = storeResult.store;
    targetStore = {
      id: store.id,
      name: store.name,
    };

    log.info("Store ensured", {
      storeId: store.id,
      status: storeResult.status,
      created: storeResult.created,
    });

    // Step 3: Check idempotency - has this delivery already been processed?
    const existingCommit = await step.run("check-idempotency", async () => {
      try {
        // Check if we've already processed this delivery
        // Use deliveryId for webhook idempotency (not afterSha to allow re-processing)
        const existing = await db.query.ingestionCommits.findFirst({
          where: and(
            eq(ingestionCommits.storeId, store.id),
            eq(ingestionCommits.deliveryId, deliveryId),
          ),
        });

        return existing ?? null;
      } catch (error) {
        log.error("Failed to check idempotency", { error, deliveryId });
        throw error;
      }
    });

    if (existingCommit) {
      log.info("Delivery already processed, skipping", {
        deliveryId,
        processedAt: existingCommit.processedAt,
      });
      return { status: "skipped", reason: "already_processed" };
    }

    // Step 4: Filter changed files by config globs
    const filteredFiles = await step.run("filter-files", async () => {
      const { minimatch } = await import("minimatch");

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
          .insert(ingestionCommits)
          .values({
            id: `${targetStore.id}_${deliveryId}`,
            storeId: targetStore.id,
            beforeSha,
            afterSha,
            deliveryId,
            status: "skipped",
          })
          .onConflictDoNothing({
            target: [ingestionCommits.storeId, ingestionCommits.afterSha],
          });
      });

      return { status: "skipped", reason: "no_matching_files" };
    }

    // Step 5: Trigger process or delete workflows for each file
    const processResults = await step.run(
      "trigger-file-workflows",
      async () => {
        const results: Array<{ path: string; action: string; status: string }> =
          [];

        for (const file of filteredFiles) {
          try {
            if (file.status === "removed") {
              // Trigger delete workflow
              await inngest.send({
                name: "apps-console/docs.file.delete",
                data: {
                  workspaceId,
                  storeName: effectiveStoreName,
                  repoFullName,
                  filePath: file.path,
                },
              });

              results.push({
                path: file.path,
                action: "delete",
                status: "queued",
              });
            } else {
              // Trigger process workflow
              await inngest.send({
                name: "apps-console/docs.file.process",
                data: {
                  workspaceId,
                  storeName: effectiveStoreName,
                  repoFullName,
                  githubInstallationId,
                  filePath: file.path,
                  commitSha: afterSha,
                  committedAt: commitTimestamp,
                },
              });

              results.push({
                path: file.path,
                action: "process",
                status: "queued",
              });
            }
          } catch (error) {
            log.error("Failed to trigger workflow", {
              path: file.path,
              error,
            });
            results.push({
              path: file.path,
              action: file.status,
              status: "failed",
            });
          }
        }

        log.info("Triggered file workflows", {
          total: filteredFiles.length,
          results,
        });

        return results;
      },
    );

    // Step 6: Record commit as processed
    await step.run("record-commit", async () => {
      try {
        if (!targetStore) {
          log.error("Cannot record commit - store context missing");
          return;
        }

        await db
          .insert(ingestionCommits)
          .values({
            id: `${targetStore.id}_${deliveryId}`,
            storeId: targetStore.id,
            beforeSha,
            afterSha,
            deliveryId,
            status: "processed",
          })
          .onConflictDoNothing({
            target: [ingestionCommits.storeId, ingestionCommits.afterSha],
          });

        log.info("Recorded commit", {
          storeId: targetStore.id,
          deliveryId,
        });
      } catch (error) {
        log.error("Failed to record commit", { error, deliveryId });
        throw error;
      }
    });

    return {
      status: "processed",
      filesProcessed: filteredFiles.length,
      results: processResults,
    };
  },
);

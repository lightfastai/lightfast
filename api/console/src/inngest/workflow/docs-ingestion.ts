/**
 * Main docs ingestion workflow
 *
 * Triggered by GitHub push webhook. Processes changed files according to
 * lightfast.yml configuration.
 *
 * Workflow steps:
 * 1. Check idempotency (has this delivery been processed?)
 * 2. Load lightfast.yml from repository
 * 3. Filter changed files by config globs
 * 4. For each file: trigger process or delete workflow
 * 5. Record commit in ingestion_commits table
 */

import { db } from "@db/console/client";
import { ingestionCommits, stores } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "../client/client";
import type { Events } from "../client/client";
import { log } from "@vendor/observability/log";
import { getOrCreateStore } from "../../lib/stores";

/**
 * Main docs ingestion function
 *
 * Orchestrates processing of a GitHub push event. Ensures idempotency
 * and delegates individual file processing to child workflows.
 */
export const docsIngestion: ReturnType<typeof inngest.createFunction> = inngest.createFunction(
	{
		id: "apps-console/docs-ingestion",
		name: "Docs Ingestion",
		retries: 3,
	},
	{ event: "apps-console/docs.push" },
	async ({ event, step }) => {
		const {
			workspaceId,
			storeName,
			repoFullName,
			githubInstallationId,
			beforeSha,
			afterSha,
			deliveryId,
			changedFiles
		} = event.data;

		log.info("Starting docs ingestion", {
			workspaceId,
			storeName,
			repoFullName,
			deliveryId,
			changedCount: changedFiles.length,
		});

		// Step 1: Check idempotency - has this delivery already been processed?
		const existingCommit = await step.run("check-idempotency", async () => {
			try {
			// First, get or create store
			const store = await getOrCreateStore({
				workspaceId,
				storeName,
				embeddingDim: 1536, // CharHash embedding dimension
			});

			// Check if we've already processed this delivery
			const existing = await db.query.ingestionCommits.findFirst({
					where: and(
						eq(ingestionCommits.storeId, store.id),
						eq(ingestionCommits.deliveryId, deliveryId)
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

		// Step 2: Load lightfast.yml from repository
		const configPatterns = await step.run("load-config", async () => {
			try {
				// Import GitHub utilities
				const { createGitHubApp, getThrottledInstallationOctokit, GitHubContentService } = await import("@repo/console-octokit-github");
				const { loadConfig } = await import("@repo/console-config");
				const { env } = await import("../../env");

				log.info("Loading lightfast.yml from repository", {
					repoFullName,
					ref: afterSha
				});

				// Create GitHub App and get installation Octokit
				const app = createGitHubApp({
					appId: env.GITHUB_APP_ID,
					privateKey: env.GITHUB_APP_PRIVATE_KEY,
				});

				const octokit = await getThrottledInstallationOctokit(app, githubInstallationId);

				// Create content service and fetch lightfast.yml
				const contentService = new GitHubContentService(octokit);
				const [owner, repo] = repoFullName.split("/");

				const configFile = await contentService.fetchSingleFile(
					owner,
					repo,
					"lightfast.yml",
					afterSha
				);

				if (!configFile) {
					log.warn("No lightfast.yml found in repository, using default patterns");
					return {
						globs: ["docs/**/*.md", "docs/**/*.mdx"],
					};
				}

				// Parse config (parse YAML then validate)
				const yaml = await import("yaml");
				const { validateConfig } = await import("@repo/console-config");

				const parsed = yaml.parse(configFile.content);
				const configResult = validateConfig(parsed);

				if (configResult.isErr()) {
					log.error("Invalid lightfast.yml config", { error: configResult.error });
					return {
						globs: ["docs/**/*.md", "docs/**/*.mdx"],
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
					globs: ["docs/**/*.md", "docs/**/*.mdx"],
				};
			}
		});

		// Step 3: Filter changed files by config globs
		const filteredFiles = await step.run("filter-files", async () => {
			const { minimatch } = await import("minimatch");

			const filtered = changedFiles.filter((file: { path: string; status: string }) => {
				return configPatterns.globs.some((glob: string) =>
					minimatch(file.path, glob)
				);
			});

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
				const [store] = await db
					.select()
					.from(stores)
					.where(and(eq(stores.workspaceId, workspaceId), eq(stores.name, storeName)))
					.limit(1);

				if (!store) {
					log.warn("Cannot record skip - store not found");
					return;
				}

				await db.insert(ingestionCommits).values({
					id: `${store.id}_${deliveryId}`,
					storeId: store.id,
					beforeSha,
					afterSha,
					deliveryId,
					status: "skipped",
				});
			});

			return { status: "skipped", reason: "no_matching_files" };
		}

		// Step 4: Trigger process or delete workflows for each file
		const processResults = await step.run("trigger-file-workflows", async () => {
			const results: Array<{ path: string; action: string; status: string }> = [];

			for (const file of filteredFiles) {
				try {
					if (file.status === "removed") {
						// Trigger delete workflow
						await inngest.send({
							name: "apps-console/docs.file.delete",
							data: {
								workspaceId,
								storeName,
								repoFullName,
								filePath: file.path,
							},
						});

						results.push({ path: file.path, action: "delete", status: "queued" });
					} else {
						// Trigger process workflow
						await inngest.send({
							name: "apps-console/docs.file.process",
							data: {
								workspaceId,
								storeName,
								repoFullName,
								githubInstallationId,
								filePath: file.path,
								commitSha: afterSha,
								committedAt: new Date().toISOString(), // TODO: Get from commit
							},
						});

						results.push({ path: file.path, action: "process", status: "queued" });
					}
				} catch (error) {
					log.error("Failed to trigger workflow", {
						path: file.path,
						error,
					});
					results.push({ path: file.path, action: file.status, status: "failed" });
				}
			}

			log.info("Triggered file workflows", {
				total: filteredFiles.length,
				results,
			});

			return results;
		});

		// Step 5: Record commit as processed
		await step.run("record-commit", async () => {
			try {
				const [store] = await db
					.select()
					.from(stores)
					.where(and(eq(stores.workspaceId, workspaceId), eq(stores.name, storeName)))
					.limit(1);

				if (!store) {
					log.error("Cannot record commit - store not found");
					return;
				}

				await db.insert(ingestionCommits).values({
					id: `${store.id}_${deliveryId}`,
					storeId: store.id,
					beforeSha,
					afterSha,
					deliveryId,
					status: "processed",
				});

				log.info("Recorded commit", {
					storeId: store.id,
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

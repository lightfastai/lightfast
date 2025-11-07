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
		const { workspaceId, storeName, beforeSha, afterSha, deliveryId, changedFiles } = event.data;

		log.info("Starting docs ingestion", {
			workspaceId,
			storeName,
			deliveryId,
			changedCount: changedFiles.length,
		});

		// Step 1: Check idempotency - has this delivery already been processed?
		const existingCommit = await step.run("check-idempotency", async () => {
			try {
				// First, get or create store
				const [store] = await db
					.select()
					.from(stores)
					.where(and(eq(stores.workspaceId, workspaceId), eq(stores.name, storeName)))
					.limit(1);

				if (!store) {
					// TODO: Create store if it doesn't exist (Phase 1.5)
					log.warn("Store not found, will need to create", {
						workspaceId,
						storeName,
					});
					return null;
				}

				// Check if we've already processed this delivery
				const [existing] = await db
					.select()
					.from(ingestionCommits)
					.where(and(eq(ingestionCommits.storeId, store.id), eq(ingestionCommits.deliveryId, deliveryId)))
					.limit(1);

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
		// TODO: Implement in next phase - for now, assume all .mdx/.md files in docs/
		const configPatterns = await step.run("load-config", async () => {
			// Placeholder: In real implementation, fetch lightfast.yml from GitHub
			// using @repo/console-config loadConfig() and @repo/console-octokit-github
			log.info("Loading config (placeholder)", { workspaceId });

			// For Phase 1, assume simple pattern
			return {
				globs: ["docs/**/*.md", "docs/**/*.mdx"],
			};
		});

		// Step 3: Filter changed files by config globs
		const filteredFiles = await step.run("filter-files", async () => {
			// TODO: Use @repo/console-config matchFiles() with actual patterns
			// For Phase 1, simple string matching
			const filtered = changedFiles.filter((file: { path: string; status: string }) => {
				const path = file.path.toLowerCase();
				return path.startsWith("docs/") && (path.endsWith(".md") || path.endsWith(".mdx"));
			});

			log.info("Filtered files", {
				total: changedFiles.length,
				matched: filtered.length,
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
								repoFullName: workspaceId, // Assuming workspaceId is repo full name
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
								repoFullName: workspaceId,
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

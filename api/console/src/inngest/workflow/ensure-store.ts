/**
 * Ensure store exists workflow
 *
 * Idempotent store and Pinecone index provisioning.
 * Can be triggered by:
 * - docs-ingestion workflow
 * - Admin API (manual store creation)
 * - Reconciliation workflow
 *
 * Workflow steps:
 * 1. Check if store exists in DB
 * 2. If not, resolve index name and check Pinecone
 * 3. Create Pinecone index if needed (idempotent)
 * 4. Create store DB record (idempotent)
 * 5. Link to repository if provided (idempotent)
 */

import { db } from "@db/console/client";
import { stores } from "@db/console/schema";
import type { Store } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { inngest } from "../client/client";
import type { Events } from "../client/client";
import { log } from "@vendor/observability/log";
import { createConsolePineconeClient } from "@repo/console-pinecone";
import { resolveEmbeddingDefaults } from "@repo/console-embed";
import { PRIVATE_CONFIG } from "@repo/console-config";
import { linkStoreToRepository } from "../../lib/stores";

/**
 * Resolve Pinecone index name from workspace and store
 *
 * Handles Pinecone naming constraints:
 * - Max 45 characters
 * - Only lowercase alphanumeric and hyphens
 * - Sanitizes special characters
 * - Hashes long names to fit within limits
 */
function resolveIndexName(workspaceKey: string, storeSlug: string): string {
	const sanitize = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9-]+/g, "-")
			.replace(/^-+/, "")
			.replace(/-+$/, "")
			.replace(/-{2,}/g, "-");

	const ws = sanitize(workspaceKey);
	const st = sanitize(storeSlug);
	let name = `${ws}-${st}`;

	const MAX = 45;
	if (name.length > MAX) {
		const hash = shortHash(`${ws}:${st}`);
		const base = name.slice(0, MAX - 5).replace(/-+$/, "");
		name = `${base}-${hash}`;
	}

	return name;
}

/**
 * Generate short hash for index name truncation
 */
function shortHash(input: string): string {
	let h = 0;
	for (let i = 0; i < input.length; i++) {
		h = (h * 31 + input.charCodeAt(i)) >>> 0;
	}
	return (h % 0xffff).toString(16).padStart(4, "0");
}

/**
 * Ensure store exists workflow
 *
 * Idempotently provisions store and Pinecone index.
 * Uses Inngest's built-in idempotency to prevent concurrent creation.
 */
export const ensureStore = inngest.createFunction(
	{
		id: "apps-console/ensure-store",
		name: "Ensure Store Exists",
		description: "Idempotently provisions store and Pinecone index",
		retries: PRIVATE_CONFIG.workflow.ensureStore.retries,

		// CRITICAL: Prevent duplicate store/index creation within 24hr window
		// Idempotency caches the result and replays it for concurrent/subsequent calls
		idempotency: 'event.data.workspaceId + "-" + event.data.storeSlug',

		// Singleton removed: Function is naturally idempotent via:
		// 1. Early return if store exists (line 141)
		// 2. onConflictDoNothing() on DB insert (line 271)
		// 3. Pinecone createIndex is idempotent (returns success if exists)
		// This allows concurrent calls to succeed instead of throwing "rate limited" errors

		// Pinecone index creation can be slow
		timeouts: PRIVATE_CONFIG.workflow.ensureStore.timeout,
	},
	{ event: "apps-console/store.ensure" },
	async ({ event, step }) => {
		const {
			workspaceId,
			workspaceKey,
			storeSlug,
			embeddingDim,
			githubRepoId,
			repoFullName,
		} = event.data;

		const startTime = Date.now();

		log.info("Ensuring store exists", {
			workspaceId,
			workspaceKey,
			storeSlug,
		});

		// Resolve embedding defaults
		const embeddingDefaults = resolveEmbeddingDefaults();
		const targetDim = embeddingDim ?? embeddingDefaults.dimension;

		// Step 1: Check if store already exists in DB
		const existingStore = await step.run("check-store-exists", async () => {
			const store = await db.query.stores.findFirst({
				where: and(
					eq(stores.workspaceId, workspaceId),
					eq(stores.slug, storeSlug),
				),
			});

			if (store) {
				log.info("Store already exists in DB", {
					storeId: store.id,
					indexName: store.indexName,
				});
			}

			return store ?? null;
		});

		// If store exists, check for configuration drift and ensure repository link
		if (existingStore) {
			// Detect configuration drift between store and current environment
			await step.run("check-config-drift", async () => {
				const currentDefaults = resolveEmbeddingDefaults();

				const hasDrift =
					existingStore.embeddingModel !== currentDefaults.model ||
					existingStore.embeddingDim !== currentDefaults.dimension;

				if (hasDrift) {
					log.warn("Store embedding configuration differs from current environment", {
						storeId: existingStore.id,
						storeSlug: existingStore.slug,
						storeConfig: {
							model: existingStore.embeddingModel,
							dimension: existingStore.embeddingDim,
							provider: existingStore.embeddingProvider,
						},
						currentDefaults: {
							model: currentDefaults.model,
							dimension: currentDefaults.dimension,
						},
						recommendation:
							"Store will continue using its original embedding configuration. " +
							"To use the new configuration, create a new store with a different name.",
					});
				} else {
					log.info("Store embedding configuration matches current environment", {
						storeId: existingStore.id,
						embeddingModel: existingStore.embeddingModel,
						embeddingDim: existingStore.embeddingDim,
					});
				}
			});

			if (githubRepoId && repoFullName) {
				await step.run("ensure-repository-link", async () => {
					await linkStoreToRepository({
						storeId: existingStore.id,
						githubRepoId,
						repoFullName,
					});
					log.info("Ensured repository link", {
						storeId: existingStore.id,
						githubRepoId,
					});
				});
			}

			return {
				status: "exists",
				store: existingStore,
				created: false,
				duration: Date.now() - startTime,
			};
		}

		// Step 2: Resolve Pinecone index name
		const indexName = await step.run("resolve-index-name", async () => {
			const nameSource = workspaceKey ?? workspaceId;
			const name = resolveIndexName(nameSource, storeSlug);

			log.info("Resolved Pinecone index name", {
				workspaceKey: nameSource,
				storeSlug,
				indexName: name,
			});

			return name;
		});

		// Step 3: Check if Pinecone index exists
		const indexExists = await step.run("check-pinecone-index", async () => {
			try {
				const pinecone = createConsolePineconeClient();
				const exists = await pinecone.indexExists(indexName);

				log.info("Checked Pinecone index existence", {
					indexName,
					exists,
				});

				return exists;
			} catch (error) {
				log.error("Failed to check Pinecone index existence", {
					error,
					indexName,
				});
				// Assume doesn't exist and try to create
				return false;
			}
		});

		// Step 4: Create Pinecone index if needed
		if (!indexExists) {
			await step.run("create-pinecone-index", async () => {
				try {
					const pinecone = createConsolePineconeClient();
					await pinecone.createIndex(indexName, targetDim);

					log.info("Created Pinecone index", {
						indexName,
						dimension: targetDim,
					});
				} catch (error) {
					log.error("Failed to create Pinecone index", {
						error,
						indexName,
						dimension: targetDim,
					});
					throw error;
				}
			});
		} else {
			log.info("Pinecone index already exists, skipping creation", {
				indexName,
			});
		}

		// Step 4b: Configure Pinecone index tags/protection
		await step.run("configure-pinecone-index", async () => {
			try {
				const pinecone = createConsolePineconeClient();
				await pinecone.configureIndex(indexName, {
					deletionProtection: PRIVATE_CONFIG.pinecone.deletionProtection,
					tags: {
						workspaceId,
						storeSlug,
					},
				});
			} catch (error) {
				log.error("Failed to configure Pinecone index", {
					error,
					indexName,
				});
				// Non-fatal: keep going so ingestion can proceed
			}
		});

		// Step 5: Create store DB record
		const store = await step.run("create-store-record", async () => {
			try {
				const storeId = `${workspaceId}_${storeSlug}`;

				const inserted = await db
					.insert(stores)
					.values({
						id: storeId,
						workspaceId,
						slug: storeSlug,
						indexName,
						embeddingDim: targetDim,
						// Hidden config fields from PRIVATE_CONFIG
						pineconeMetric: PRIVATE_CONFIG.pinecone.metric,
						pineconeCloud: PRIVATE_CONFIG.pinecone.cloud,
						pineconeRegion: PRIVATE_CONFIG.pinecone.region,
						chunkMaxTokens: PRIVATE_CONFIG.chunking.maxTokens,
						chunkOverlap: PRIVATE_CONFIG.chunking.overlap,
						// Embedding config from resolved defaults
						embeddingModel: embeddingDefaults.model,
						embeddingProvider: embeddingDefaults.provider,
					})
					.onConflictDoNothing()
					.returning();

				if (inserted?.[0]) {
					log.info("Created store DB record", { storeId: inserted[0].id });
					return inserted[0];
				}

				// Concurrent creation succeeded, fetch the record
				const existing = await db.query.stores.findFirst({
					where: and(
						eq(stores.workspaceId, workspaceId),
						eq(stores.slug, storeSlug),
					),
				});

				if (!existing) {
					throw new Error(
						`Failed to create or fetch store: ${workspaceId}/${storeSlug}`,
					);
				}

				log.info("Store created concurrently, fetched existing record", {
					storeId: existing.id,
				});

				return existing;
			} catch (error) {
				log.error("Failed to create store DB record", {
					error,
					workspaceId,
					storeSlug,
				});
				throw error;
			}
		});

		// Step 6: Link to repository if provided
		if (githubRepoId && repoFullName) {
			await step.run("link-repository", async () => {
				try {
					await linkStoreToRepository({
						storeId: store.id,
						githubRepoId,
						repoFullName,
					});

					log.info("Linked store to repository", {
						storeId: store.id,
						githubRepoId,
						repoFullName,
					});
				} catch (error) {
					log.error("Failed to link store to repository", {
						error,
						storeId: store.id,
						githubRepoId,
					});
					// Don't fail workflow if link fails
				}
			});
		}

		const duration = Date.now() - startTime;

		log.info("Store provisioned successfully", {
			storeId: store.id,
			indexName: store.indexName,
			duration,
		});

		return {
			status: "created",
			store,
			created: true,
			duration,
		};
	},
);

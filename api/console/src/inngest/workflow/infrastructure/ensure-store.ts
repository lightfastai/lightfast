/**
 * Ensure store exists workflow
 *
 * ARCHITECTURE:
 * - Each workspace has exactly ONE store (1:1 relationship)
 * - Store ID = workspaceId
 * - All stores share Pinecone indexes from PRIVATE_CONFIG (cost optimization)
 * - Each workspace gets a unique namespace within the shared index
 * - Format: {clerkOrgId}:ws_{workspaceId}
 * - Example: org_123abc:ws_0iu9we9itb2ez17bh5cji
 *
 * Idempotent store and Pinecone namespace provisioning.
 * Can be triggered by:
 * - docs-ingestion workflow
 * - Admin API (manual store creation)
 * - Reconciliation workflow
 *
 * Workflow steps:
 * 1. Check if store exists in DB (by workspaceId)
 * 2. If not, resolve namespace name and check shared Pinecone index
 * 3. Ensure shared Pinecone index exists (idempotent)
 * 4. Create store DB record with namespace reference (idempotent)
 */

import type { WorkspaceStore } from "@db/console/schema";
import { inngest } from "../../client/client";
import type { Events } from "../../client/client";
import { log } from "@vendor/observability/log";
import { createConsolePineconeClient } from "@repo/console-pinecone";
import { resolveEmbeddingDefaults } from "@repo/console-embed";
import { PRIVATE_CONFIG } from "@repo/console-config";
import { createInngestCaller } from "../../lib";

/**
 * Resolve hierarchical namespace name for a workspace
 *
 * Format: {clerkOrgId}:ws_{workspaceId}
 * Example: "org_123abc:ws_0iu9we9itb2ez17bh5cji"
 *
 * Note: clerkOrgId already contains "org_" prefix (e.g., "org_123abc")
 * workspaceId is the stable UUID identifier (also serves as store ID)
 *
 * All workspaces share indexes from PRIVATE_CONFIG.pinecone.indexes.
 *
 * Pinecone namespace constraints:
 * - Max length: 2048 characters ✅
 * - Allowed characters: Alphanumeric, hyphens, underscores
 * - Auto-created on first upsert
 */
function resolveNamespaceName(
	clerkOrgId: string,
	workspaceId: string,
): string {
	const sanitize = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, "")
			.slice(0, 50); // Safety limit for namespace segment

	// clerkOrgId already has "org_" prefix (e.g., "org_35ztohqbmqsscw67jwbywlg2l51")
	// Sanitize preserves underscores, so we get clean namespace names
	return `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}`;
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
 * Idempotently provisions store and Pinecone namespace.
 * Uses Inngest's built-in idempotency to prevent concurrent creation.
 */
export const ensureStore = inngest.createFunction(
	{
		id: "apps-console/ensure-store",
		name: "Ensure Store Exists",
		description: "Idempotently provisions store and Pinecone namespace",
		retries: 5,

		// CRITICAL: Prevent duplicate store creation within 24hr window
		// Idempotency caches the result and replays it for concurrent/subsequent calls
		// Each workspace has exactly one store, so workspaceId is the idempotency key
		idempotency: "event.data.workspaceId",

		// Singleton removed: Function is naturally idempotent via:
		// 1. Early return if store exists
		// 2. onConflictDoNothing() on DB insert
		// 3. Pinecone createIndex is idempotent (returns success if exists)
		// This allows concurrent calls to succeed instead of throwing "rate limited" errors

		// Pinecone index creation can be slow
		timeouts: {
			start: "1m",
			finish: "10m",
		},
	},
	{ event: "apps-console/store.ensure" },
	async ({ event, step }: { event: any; step: any }) => {
		const {
			workspaceId,
			workspaceKey,
			embeddingDim,
			githubRepoId,
			repoFullName,
		} = event.data;

		const startTime = Date.now();

		log.info("Ensuring store exists", {
			workspaceId,
			workspaceKey,
		});

		// Create tRPC caller for database operations
		const trpc = await createInngestCaller();

		// Resolve embedding defaults
		const embeddingDefaults = resolveEmbeddingDefaults();
		const targetDim = embeddingDim ?? embeddingDefaults.dimension;

		// Step 1: Check if store already exists in DB (by workspaceId)
		const existingStore = await step.run("store.check-exists", async () => {
			const store = await trpc.stores.get({
				workspaceId,
			});

			if (store) {
				log.info("Store already exists in DB", {
					storeId: store.id,
					indexName: store.indexName,
					namespaceName: store.namespaceName,
				});
			}

			return store ?? null;
		});

		// If store exists, check for configuration drift
		if (existingStore) {
			// Detect configuration drift between store and current environment
			await step.run("config.check-drift", async () => {
				const currentDefaults = resolveEmbeddingDefaults();

				const hasDrift =
					existingStore.embeddingModel !== currentDefaults.model ||
					existingStore.embeddingDim !== currentDefaults.dimension;

				if (hasDrift) {
					log.warn("Store embedding configuration differs from current environment", {
						storeId: existingStore.id,
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
							"To use the new configuration, recreate the workspace.",
					});
				} else {
					log.info("Store embedding configuration matches current environment", {
						storeId: existingStore.id,
						embeddingModel: existingStore.embeddingModel,
						embeddingDim: existingStore.embeddingDim,
					});
				}
			});

			return {
				status: "exists",
				store: existingStore,
				created: false,
				duration: Date.now() - startTime,
			};
		}

		// Step 2: Fetch workspace and resolve namespace name
		const { namespaceName, sharedIndexName } = await step.run(
			"namespace.resolve",
			async () => {
				// Fetch workspace to get clerkOrgId
				const workspace = await trpc.workspace.get({
					workspaceId,
				});

				// Generate hierarchical namespace name using workspaceId (stable UUID)
				const namespaceName = resolveNamespaceName(
					workspace.clerkOrgId,
					workspaceId,
				);

				// Use shared production index from PRIVATE_CONFIG
				const sharedIndexName = PRIVATE_CONFIG.pinecone.indexes.production.name;

				log.info("Resolved namespace for store", {
					clerkOrgId: workspace.clerkOrgId,
					workspaceId,
					namespaceName,
					sharedIndexName,
				});

				return { namespaceName, sharedIndexName };
			},
		);

		// Step 3: Check if shared Pinecone index exists
		const indexExists = await step.run("index.check-exists", async () => {
			try {
				const pinecone = createConsolePineconeClient();
				const exists = await pinecone.indexExists(sharedIndexName);

				log.info("Checked shared Pinecone index existence", {
					indexName: sharedIndexName,
					exists,
				});

				return exists;
			} catch (error) {
				log.error("Failed to check shared Pinecone index existence", {
					error,
					indexName: sharedIndexName,
				});
				// Assume doesn't exist and try to create
				return false;
			}
		});

		// Step 4: Create shared Pinecone index if needed (rare - usually exists)
		if (!indexExists) {
			await step.run("index.create", async () => {
				try {
					const pinecone = createConsolePineconeClient();
					await pinecone.createIndex(sharedIndexName, targetDim);

					log.info("Created shared Pinecone index", {
						indexName: sharedIndexName,
						dimension: targetDim,
					});
				} catch (error) {
					log.error("Failed to create shared Pinecone index", {
						error,
						indexName: sharedIndexName,
						dimension: targetDim,
					});
					throw error;
				}
			});
		} else {
			log.info("Shared Pinecone index already exists", {
				indexName: sharedIndexName,
			});
		}

		// Step 4b: Configure shared Pinecone index tags/protection
		await step.run("index.configure", async () => {
			try {
				const pinecone = createConsolePineconeClient();
				await pinecone.configureIndex(sharedIndexName, {
					deletionProtection: PRIVATE_CONFIG.pinecone.deletionProtection,
					tags: {
						environment: "production",
						managedBy: "lightfast-console",
					},
				});
			} catch (error) {
				log.error("Failed to configure shared Pinecone index", {
					error,
					indexName: sharedIndexName,
				});
				// Non-fatal: keep going so ingestion can proceed
			}
		});

		// Step 5: Create store DB record (store ID = workspaceId for 1:1 relationship)
		const store = await step.run("store.create-record", async () => {
			// Store ID = workspaceId (1:1 relationship)
			const storeId = workspaceId;

			// Create store via tRPC (handles idempotent insert + fallback fetch)
			const result = await trpc.stores.create({
				id: storeId,
				workspaceId,
				indexName: sharedIndexName,
				namespaceName: namespaceName,
				// All config values explicitly passed from PRIVATE_CONFIG
				// No database defaults - ensures consistency with config layer
				embeddingDim: targetDim,
				embeddingModel: embeddingDefaults.model,
				embeddingProvider: PRIVATE_CONFIG.embedding.cohere.provider,
				pineconeMetric: PRIVATE_CONFIG.pinecone.metric,
				pineconeCloud: PRIVATE_CONFIG.pinecone.cloud,
				pineconeRegion: PRIVATE_CONFIG.pinecone.region,
				chunkMaxTokens: PRIVATE_CONFIG.chunking.maxTokens,
				chunkOverlap: PRIVATE_CONFIG.chunking.overlap,
			});

			if (result.created) {
				log.info("Created store DB record", { storeId: result.store.id });
			} else {
				log.info("Store created concurrently, fetched existing record", {
					storeId: result.store.id,
				});
			}

			return result.store;
		});

		const duration = Date.now() - startTime;

		log.info("Store provisioned successfully", {
			storeId: store.id,
			indexName: store.indexName,
			namespaceName: store.namespaceName,
			duration,
		});

		return {
			status: "created",
			store,
			storeId: store.id,
			indexReady: true,
			created: true,
			duration,
		};
	},
);

/**
 * Store management utilities
 *
 * Shared business logic for store provisioning that can be used by
 * both tRPC routers and Inngest workflows.
 */

import { db } from "@db/console/client";
import { stores } from "@db/console/schema";
import type { Store } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { createPineconeClient } from "@vendor/pinecone";
import { log } from "@vendor/observability/log";

/**
 * Get or create store with Pinecone index auto-provisioning
 *
 * This is the shared business logic used by both:
 * - tRPC stores.getOrCreate procedure
 * - Inngest docs-ingestion workflow
 */
export async function getOrCreateStore(params: {
	workspaceId: string;
	storeName: string;
	embeddingDim?: number;
}): Promise<Store> {
	const { workspaceId, storeName, embeddingDim = 1536 } = params;

	// Check if store already exists
	let store = await db.query.stores.findFirst({
		where: and(eq(stores.workspaceId, workspaceId), eq(stores.name, storeName)),
	});

	if (store) {
		return store;
	}

	// Auto-provision new store
	log.info("Store not found, auto-provisioning", { workspaceId, storeName });

	const pinecone = createPineconeClient();
	const indexName = pinecone.resolveIndexName(workspaceId, storeName);

	log.info("Creating Pinecone index", { indexName, embeddingDim });
	await pinecone.createIndex(workspaceId, storeName, embeddingDim);

	const storeId = `${workspaceId}_${storeName}`;
	const [newStore] = await db
		.insert(stores)
		.values({
			id: storeId,
			workspaceId,
			name: storeName,
			indexName,
			embeddingDim,
		})
		.returning();

	if (!newStore) {
		throw new Error("Failed to create store record");
	}

	store = newStore;
	log.info("Store auto-provisioned successfully", { storeId, indexName });

	return store;
}

/**
 * Get a store by name
 */
export async function getStoreByName(storeName: string): Promise<Store> {
	const store = await db.query.stores.findFirst({
		where: eq(stores.name, storeName),
	});

	if (!store) {
		throw new Error(`Store not found: ${storeName}`);
	}

	return store;
}

/**
 * List all stores for a workspace
 */
export async function listStoresByWorkspace(
	workspaceId: string,
): Promise<Store[]> {
	return db.query.stores.findMany({
		where: eq(stores.workspaceId, workspaceId),
	});
}

/**
 * Store management utilities
 *
 * Provides low-level functions for store operations.
 *
 * **IMPORTANT:** For store creation, use the `ensure-store` workflow instead
 * of `getOrCreateStore` to ensure proper idempotency and Pinecone index management.
 *
 * The workflow approach prevents race conditions and provides better observability.
 */

import { db } from "@db/console/client";
import { stores } from "@db/console/schema";
import type { Store } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { createConsolePineconeClient } from "@repo/console-pinecone";
import { log } from "@vendor/observability/log";
import { resolveEmbeddingDefaults } from "@repo/console-embed";
import { PRIVATE_CONFIG } from "@repo/console-config";

/**
 * Resolve Pinecone index name from workspace key and store slug
 *
 * Pinecone constraints:
 * - Max 45 characters
 * - Only lowercase alphanumeric and hyphens
 *
 * Workspace keys and store slugs are pre-validated (max 20 chars each),
 * so combined they should fit: ws-{slug}-{store} = 3 + 20 + 1 + 20 = 44 chars max.
 */
function resolveIndexName(workspaceKey: string, storeSlug: string): string {
  const indexName = `${workspaceKey}-${storeSlug}`;

  if (indexName.length > 45) {
    throw new Error(
      `Pinecone index name exceeds 45 char limit: "${indexName}" (${indexName.length} chars). ` +
        `This should not happen if workspace slug and store slug are properly validated (max 20 chars each).`,
    );
  }

  return indexName;
}

/**
 * Get or create store with Pinecone index auto-provisioning
 *
 * @deprecated Prefer using the `ensure-store` Inngest workflow for store creation.
 * This function is kept for backwards compatibility but may have race conditions
 * when called concurrently.
 *
 * **Recommended:**
 * ```typescript
 * await inngest.send({
 *   name: "apps-console/store.ensure",
 *   data: { workspaceId, storeSlug, ... }
 * });
 * ```
 *
 * **Legacy usage (avoid if possible):**
 * This function is still used for:
 * - Quick read operations (fetching existing stores)
 * - Migration scripts
 * - Testing/development
 */
export async function getOrCreateStore(params: {
  workspaceId: string; // DB UUID
  storeSlug: string;
  embeddingDim?: number;
  workspaceKey?: string; // canonical external key for naming, optional
}): Promise<Store> {
  // Resolve embedding defaults at runtime
  const embeddingDefaults = resolveEmbeddingDefaults();

  const {
    workspaceId,
    storeSlug,
    embeddingDim = embeddingDefaults.dimension,
    workspaceKey,
  } = params;

  // Check if store already exists
  let store = await db.query.stores.findFirst({
    where: and(eq(stores.workspaceId, workspaceId), eq(stores.slug, storeSlug)),
  });

  if (store) {
    return store;
  }

	// Auto-provision new store
	log.info("Store not found, auto-provisioning", { workspaceId, storeSlug });

  const pinecone = createConsolePineconeClient();
  const nameSource = workspaceKey ?? workspaceId;
  const indexName = resolveIndexName(nameSource, storeSlug);

  log.info("Creating Pinecone index", { indexName, embeddingDim });
  await pinecone.createIndex(indexName, embeddingDim);
  try {
    await pinecone.configureIndex(indexName, {
      deletionProtection: PRIVATE_CONFIG.pinecone.deletionProtection,
      tags: {
        workspaceId,
        storeSlug,
      },
    });
  } catch (error) {
    log.warn("Failed to configure Pinecone index after creation", {
      error,
      indexName,
    });
  }

	const storeId = `${workspaceId}_${storeSlug}`;
  const inserted = await db
    .insert(stores)
    .values({
      id: storeId,
      workspaceId,
      slug: storeSlug,
      indexName,
      // All config values explicitly passed from PRIVATE_CONFIG
      // No database defaults - ensures consistency with config layer
      embeddingDim,
      embeddingModel: embeddingDefaults.model,
      embeddingProvider: PRIVATE_CONFIG.embedding.cohere.provider,
      pineconeMetric: PRIVATE_CONFIG.pinecone.metric,
      pineconeCloud: PRIVATE_CONFIG.pinecone.cloud,
      pineconeRegion: PRIVATE_CONFIG.pinecone.region,
      chunkMaxTokens: PRIVATE_CONFIG.chunking.maxTokens,
      chunkOverlap: PRIVATE_CONFIG.chunking.overlap,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted && inserted[0]) {
    store = inserted[0];
  } else {
    // Another concurrent creator likely inserted; fetch the record
    store = await db.query.stores.findFirst({
      where: and(eq(stores.workspaceId, workspaceId), eq(stores.slug, storeSlug)),
    });
    if (!store) {
      throw new Error("Failed to create or fetch store record");
    }
  }
	log.info("Store auto-provisioned successfully", { storeId, indexName });

	return store;
}

/**
 * Get a store by slug
 */
export async function getStoreBySlug(storeSlug: string): Promise<Store> {
	const store = await db.query.stores.findFirst({
		where: eq(stores.slug, storeSlug),
	});

	if (!store) {
		throw new Error(`Store not found: ${storeSlug}`);
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

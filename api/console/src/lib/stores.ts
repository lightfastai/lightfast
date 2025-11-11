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
import { stores, storeRepositories } from "@db/console/schema";
import type { Store } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { createConsolePineconeClient } from "@repo/console-pinecone";
import { log } from "@vendor/observability/log";
import { resolveEmbeddingDefaults } from "@repo/console-embed";
import { PRIVATE_CONFIG } from "@repo/console-config";

/**
 * Resolve Pinecone index name from workspace and store
 *
 * Handles Pinecone naming constraints:
 * - Max 45 characters
 * - Only lowercase alphanumeric and hyphens
 * - Sanitizes special characters
 * - Hashes long names to fit within limits
 */
function resolveIndexName(workspaceKey: string, storeName: string): string {
  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+/, "")
      .replace(/-+$/, "")
      .replace(/-{2,}/g, "-");

  const ws = sanitize(workspaceKey);
  const st = sanitize(storeName);
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
 *   data: { workspaceId, storeName, ... }
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
  storeName: string;
  embeddingDim?: number;
  workspaceKey?: string; // canonical external key for naming, optional
}): Promise<Store> {
  // Resolve embedding defaults at runtime
  const embeddingDefaults = resolveEmbeddingDefaults();

  const {
    workspaceId,
    storeName,
    embeddingDim = embeddingDefaults.dimension,
    workspaceKey,
  } = params;

  // Check if store already exists (canonical workspaceId)
  let store = await db.query.stores.findFirst({
    where: and(eq(stores.workspaceId, workspaceId), eq(stores.name, storeName)),
  });

  // Fallback: try legacy workspaceId variant (underscore vs hyphen)
  if (!store) {
    const legacyWsId = workspaceId.includes("ws-")
      ? workspaceId.replace(/^ws-/, "ws_")
      : workspaceId.includes("ws_")
        ? workspaceId.replace(/^ws_/, "ws-")
        : undefined;

    if (legacyWsId) {
      const legacy = await db.query.stores.findFirst({
        where: and(eq(stores.workspaceId, legacyWsId), eq(stores.name, storeName)),
      });
      if (legacy) {
        log.info("Using legacy store bound to alternate workspaceId", { legacyWorkspaceId: legacyWsId, storeId: legacy.id });
        return legacy;
      }
    }
  }

  if (store) {
    return store;
  }

	// Auto-provision new store
	log.info("Store not found, auto-provisioning", { workspaceId, storeName });

  const pinecone = createConsolePineconeClient();
  const nameSource = workspaceKey ?? workspaceId;
  const indexName = resolveIndexName(nameSource, storeName);

  log.info("Creating Pinecone index", { indexName, embeddingDim });
  await pinecone.createIndex(indexName, embeddingDim);

	const storeId = `${workspaceId}_${storeName}`;
  const inserted = await db
    .insert(stores)
    .values({
      id: storeId,
      workspaceId,
      name: storeName,
      indexName,
      embeddingDim,
      // Hidden config fields from PRIVATE_CONFIG
      pineconeMetric: PRIVATE_CONFIG.pinecone.metric,
      pineconeCloud: PRIVATE_CONFIG.pinecone.cloud,
      pineconeRegion: PRIVATE_CONFIG.pinecone.region,
      chunkMaxTokens: PRIVATE_CONFIG.chunking.maxTokens,
      chunkOverlap: PRIVATE_CONFIG.chunking.overlap,
      // Embedding config from resolved defaults
      embeddingModel: embeddingDefaults.model,
      embeddingProvider: embeddingDefaults.model.includes("cohere") ? "cohere" : "charHash",
    })
    .onConflictDoNothing()
    .returning();

  if (inserted && inserted[0]) {
    store = inserted[0];
  } else {
    // Another concurrent creator likely inserted; fetch the record
    store = await db.query.stores.findFirst({
      where: and(eq(stores.workspaceId, workspaceId), eq(stores.name, storeName)),
    });
    if (!store) {
      throw new Error("Failed to create or fetch store record");
    }
  }
	log.info("Store auto-provisioned successfully", { storeId, indexName });

	return store;
}

/**
 * Link a store to a GitHub repository for auditing and deduping.
 */
export async function linkStoreToRepository(params: {
  storeId: string;
  githubRepoId: number | string;
  repoFullName: string;
}) {
  const repoId =
    typeof params.githubRepoId === "string"
      ? params.githubRepoId
      : params.githubRepoId.toString();

  await db
    .insert(storeRepositories)
    .values({
      storeId: params.storeId,
      githubRepoId: repoId,
      repoFullName: params.repoFullName,
    })
    .onConflictDoUpdate({
      target: storeRepositories.githubRepoId,
      set: {
        storeId: params.storeId,
        repoFullName: params.repoFullName,
        linkedAt: new Date(),
      },
    });
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

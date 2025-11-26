import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { inngestM2MProcedure } from "../../trpc";
import { db } from "@db/console/client";
import { workspaceStores } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import {
	embeddingModelSchema,
	embeddingProviderSchema,
	pineconeMetricSchema,
	pineconeCloudSchema,
	pineconeRegionSchema,
	chunkMaxTokensSchema,
	chunkOverlapSchema,
} from "@repo/console-validation";

/**
 * Stores M2M Router
 *
 * Machine-to-machine procedures for store management.
 * Used exclusively by Inngest workflows.
 *
 * User-facing store operations are in workspace.stores sub-router.
 */
export const storesM2MRouter = {
	/**
	 * Get store by workspace ID and slug (Inngest workflows)
	 *
	 * Used by Inngest workflows to check if store exists before processing.
	 * Returns null if store doesn't exist (workflows handle creation via ensure-store).
	 */
	get: inngestM2MProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				storeSlug: z.string(),
			}),
		)
		.query(async ({ input }) => {
			const store = await db.query.workspaceStores.findFirst({
				where: and(
					eq(workspaceStores.workspaceId, input.workspaceId),
					eq(workspaceStores.slug, input.storeSlug),
				),
			});

			return store ?? null;
		}),

	/**
	 * Create store record (Inngest workflows)
	 *
	 * Used by ensure-store workflow to create DB record after Pinecone index is created.
	 * Uses onConflictDoNothing for idempotency.
	 */
	create: inngestM2MProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
				slug: z.string(),
				indexName: z.string(),
				namespaceName: z.string(), // Hierarchical namespace within shared index
				embeddingDim: z.number(),
				embeddingModel: embeddingModelSchema,
				embeddingProvider: embeddingProviderSchema,
				pineconeMetric: pineconeMetricSchema,
				pineconeCloud: pineconeCloudSchema,
				pineconeRegion: pineconeRegionSchema,
				chunkMaxTokens: chunkMaxTokensSchema,
				chunkOverlap: chunkOverlapSchema,
			}),
		)
		.mutation(async ({ input }) => {
			const inserted = await db
				.insert(workspaceStores)
				.values(input)
				.onConflictDoNothing()
				.returning();

			if (inserted?.[0]) {
				return { created: true, store: inserted[0] };
			}

			// Concurrent creation succeeded, fetch the record
			const existing = await db.query.workspaceStores.findFirst({
				where: and(
					eq(workspaceStores.workspaceId, input.workspaceId),
					eq(workspaceStores.slug, input.slug),
				),
			});

			if (!existing) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: `Failed to create or fetch store: ${input.workspaceId}/${input.slug}`,
				});
			}

			return { created: false, store: existing };
		}),
} satisfies TRPCRouterRecord;

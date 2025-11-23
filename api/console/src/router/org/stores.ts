import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { resolveEmbeddingDefaults } from "@repo/console-embed";
import { protectedProcedure, inngestM2MProcedure, resolveWorkspaceByName } from "../../trpc";
import {
	getOrCreateStore,
	getStoreBySlug,
	listStoresByWorkspace,
} from "../../lib/stores";
import { db } from "@db/console/client";
import { stores } from "@db/console/schema";
import { eq, and } from "drizzle-orm";

const { dimension: storeEmbeddingDimension } = resolveEmbeddingDefaults();

/**
 * Stores Router
 *
 * Manages Pinecone vector stores for workspaces.
 * Handles auto-provisioning of stores and indexes.
 *
 * Business logic is in lib/stores.ts for reuse by Inngest workflows.
 */
export const storesRouter = {
	/**
	 * Get or create a store for a workspace
	 *
	 * Auto-provisions Pinecone index if store doesn't exist.
	 */
	getOrCreate: protectedProcedure
		.input(
			z.object({
				clerkOrgSlug: z.string(),
				workspaceName: z.string(),
				storeSlug: z.string(),
				embeddingDim: z.number().default(storeEmbeddingDimension),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			// Verify workspace access via helper
			const { workspaceId } = await resolveWorkspaceByName({
				clerkOrgSlug: input.clerkOrgSlug,
				workspaceName: input.workspaceName,
				userId: ctx.auth.userId,
			});

			return getOrCreateStore({
				workspaceId,
				storeSlug: input.storeSlug,
				embeddingDim: input.embeddingDim,
			});
		}),

	/**
	 * Get a store by name
	 */
	getByName: protectedProcedure
		.input(
			z.object({
				clerkOrgSlug: z.string(),
				workspaceName: z.string(),
				storeSlug: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify workspace access via helper
			const { workspaceId } = await resolveWorkspaceByName({
				clerkOrgSlug: input.clerkOrgSlug,
				workspaceName: input.workspaceName,
				userId: ctx.auth.userId,
			});

			// Get store and verify it belongs to workspace
			const store = await getStoreBySlug(input.storeSlug);

			if (store.workspaceId !== workspaceId) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Store not found or access denied",
				});
			}

			return store;
		}),

	/**
	 * List all stores for a workspace
	 */
	listByWorkspace: protectedProcedure
		.input(
			z.object({
				clerkOrgSlug: z.string(),
				workspaceName: z.string(),
			}),
		)
		.query(async ({ ctx, input }) => {
			// Verify workspace access via helper
			const { workspaceId } = await resolveWorkspaceByName({
				clerkOrgSlug: input.clerkOrgSlug,
				workspaceName: input.workspaceName,
				userId: ctx.auth.userId,
			});

			return listStoresByWorkspace(workspaceId);
		}),

	// ============================================================================
	// Inngest M2M Procedures
	// ============================================================================

	/**
	 * Get store by workspace ID and slug (Inngest workflows)
	 *
	 * Used by Inngest workflows to check if store exists before processing.
	 * Returns null if store doesn't exist (workflows handle creation via ensure-store).
	 */
	getForInngest: inngestM2MProcedure
		.input(
			z.object({
				workspaceId: z.string(),
				storeSlug: z.string(),
			}),
		)
		.query(async ({ input }) => {
			const store = await db.query.stores.findFirst({
				where: and(
					eq(stores.workspaceId, input.workspaceId),
					eq(stores.slug, input.storeSlug),
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
	createForInngest: inngestM2MProcedure
		.input(
			z.object({
				id: z.string(),
				workspaceId: z.string(),
				slug: z.string(),
				indexName: z.string(),
				embeddingDim: z.number(),
				embeddingModel: z.string(),
				embeddingProvider: z.enum(["cohere"]),
				pineconeMetric: z.enum(["cosine", "euclidean", "dotproduct"]),
				pineconeCloud: z.enum(["aws", "gcp", "azure"]),
				pineconeRegion: z.string(),
				chunkMaxTokens: z.number(),
				chunkOverlap: z.number(),
			}),
		)
		.mutation(async ({ input }) => {
			const inserted = await db
				.insert(stores)
				.values(input)
				.onConflictDoNothing()
				.returning();

			if (inserted?.[0]) {
				return { created: true, store: inserted[0] };
			}

			// Concurrent creation succeeded, fetch the record
			const existing = await db.query.stores.findFirst({
				where: and(
					eq(stores.workspaceId, input.workspaceId),
					eq(stores.slug, input.slug),
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

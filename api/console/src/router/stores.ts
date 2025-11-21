import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { resolveEmbeddingDefaults } from "@repo/console-embed";
import { protectedProcedure, resolveWorkspaceByName } from "../trpc";
import {
	getOrCreateStore,
	getStoreBySlug,
	listStoresByWorkspace,
} from "../lib/stores";

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
} satisfies TRPCRouterRecord;

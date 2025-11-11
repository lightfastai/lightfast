import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod";
import { resolveEmbeddingDefaults } from "@repo/console-embed";
import { protectedProcedure } from "../trpc";
import {
	getOrCreateStore,
	getStoreByName,
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
					workspaceId: z.string(),
					storeName: z.string(),
					embeddingDim: z.number().default(storeEmbeddingDimension),
				}),
		)
		.mutation(async ({ input }) => {
			return getOrCreateStore(input);
		}),

	/**
	 * Get a store by name
	 */
	getByName: protectedProcedure
		.input(
			z.object({
				storeName: z.string(),
			}),
		)
		.query(async ({ input }) => {
			return getStoreByName(input.storeName);
		}),

	/**
	 * List all stores for a workspace
	 */
	listByWorkspace: protectedProcedure
		.input(
			z.object({
				workspaceId: z.string(),
			}),
		)
		.query(async ({ input }) => {
			return listStoresByWorkspace(input.workspaceId);
		}),
} satisfies TRPCRouterRecord;

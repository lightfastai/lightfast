/**
 * Search tRPC router
 *
 * Implements /v1/search endpoint using Pinecone vector search
 */

import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../trpc";
import {
	SearchRequestSchema,
	SearchResponseSchema,
	type SearchResponse,
} from "@repo/console-types/api";
import { pineconeClient } from "@vendor/pinecone";
import { createCharHashEmbedding } from "@repo/console-embed";
import { log } from "@vendor/observability/log";
import { randomUUID } from "node:crypto";
import { db } from "@db/console/client";
import { stores } from "@db/console/schema";
import { eq, and } from "drizzle-orm";

/**
 * Search router - public procedures for search endpoints
 */
export const searchRouter = {
	/**
	 * Query endpoint - search documents by semantic similarity
	 *
	 * @example
	 * ```typescript
	 * const result = await trpc.search.query.query({
	 *   query: "how to authenticate users",
	 *   topK: 10,
	 *   filters: {
	 *     labels: ["store:docs"]
	 *   }
	 * });
	 * ```
	 */
	query: publicProcedure
		.input(SearchRequestSchema)
		.output(SearchResponseSchema)
		.query(async ({ input }): Promise<SearchResponse> => {
			const startTime = Date.now();
			const requestId = randomUUID();

			log.info("Search query", {
				requestId,
				query: input.query,
				topK: input.topK,
				filters: input.filters,
			});

			try {
				// Extract store from filters
				const storeLabel = input.filters?.labels?.find((l: string) => l.startsWith("store:"));
				if (!storeLabel) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Store label required in filters (e.g., store:docs)",
					});
				}

				const storeName = storeLabel.replace("store:", "");

				// Phase 1.6: Look up store to get workspaceId
				const store = await db.query.stores.findFirst({
					where: eq(stores.name, storeName),
				});

				if (!store) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: `Store not found: ${storeName}`,
					});
				}

				const workspaceId = store.workspaceId;
				const indexName = store.indexName;

				log.info("Resolved index", {
					requestId,
					workspaceId,
					storeName,
					indexName,
					storeId: store.id,
				});

				// Generate query embedding
				const embedStart = Date.now();
				const embedding = createCharHashEmbedding();
				const { embeddings } = await embedding.embed([input.query]);
				const embedLatency = Date.now() - embedStart;

				const queryVector = embeddings[0];
				if (!queryVector) {
					throw new TRPCError({
						code: "INTERNAL_SERVER_ERROR",
						message: "Failed to generate query embedding",
					});
				}

				log.info("Generated embedding", {
					requestId,
					embedLatency,
					dimension: queryVector.length,
				});

				// Query Pinecone
				const queryStart = Date.now();
				const results = await pineconeClient.query(indexName, {
					vector: queryVector,
					topK: input.topK,
					includeMetadata: true,
				});
				const queryLatency = Date.now() - queryStart;

				log.info("Pinecone query complete", {
					requestId,
					queryLatency,
					matchCount: results.matches.length,
				});

				// Map results to SearchResponse format
				const searchResults = results.matches.map((match) => ({
					id: match.id,
					title: (match.metadata?.title as string) || "",
					url: (match.metadata?.url as string) || "",
					snippet: (match.metadata?.snippet as string) || "",
					score: match.score,
					metadata: match.metadata || {},
				}));

				const response: SearchResponse = {
					results: searchResults,
					requestId,
					latency: {
						total: Date.now() - startTime,
						retrieval: queryLatency,
						// TODO: Add rerank latency when reranking is implemented
					},
				};

				log.info("Search complete", {
					requestId,
					totalLatency: response.latency.total,
					resultCount: searchResults.length,
				});

				return response;
			} catch (error) {
				log.error("Search failed", {
					requestId,
					error,
					query: input.query,
				});

				// Re-throw TRPCErrors
				if (error instanceof TRPCError) {
					throw error;
				}

				// Convert other errors to TRPCError
				const message = error instanceof Error ? error.message : "Search failed";
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message,
					cause: error,
				});
			}
		}),
} satisfies TRPCRouterRecord;

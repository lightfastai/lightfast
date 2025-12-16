/**
 * Search tRPC router
 *
 * Implements /v1/search endpoint using Pinecone vector search
 */

import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { apiKeyProcedure } from "../../trpc";
import {
	SearchRequestSchema,
	SearchResponseSchema,
	type SearchResponse,
} from "@repo/console-types/api";
import { pineconeClient } from "@repo/console-pinecone";
import type { VectorMetadata } from "@repo/console-pinecone";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import { log } from "@vendor/observability/log";
import { randomUUID } from "node:crypto";
import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { eq } from "drizzle-orm";

/**
 * Search router - API key protected procedures for search endpoints
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
	query: apiKeyProcedure
		.input(SearchRequestSchema)
		.output(SearchResponseSchema)
		.query(async ({ ctx, input }): Promise<SearchResponse> => {
			const startTime = Date.now();
			const requestId = randomUUID();

			log.info("Search query", {
				requestId,
				workspaceId: ctx.auth.workspaceId,
				userId: ctx.auth.userId,
				query: input.query,
				topK: input.topK,
				filters: input.filters,
			});

			try {
				// Look up workspace configuration
				const workspace = await db.query.orgWorkspaces.findFirst({
					where: eq(orgWorkspaces.id, ctx.auth.workspaceId),
				});

				if (!workspace) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Workspace not found",
					});
				}

				if (workspace.settings.version !== 1) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: "Workspace has invalid settings",
					});
				}

				const indexName = workspace.settings.embedding.indexName;
				const namespaceName = workspace.settings.embedding.namespaceName;

				log.info("Resolved index and namespace", {
					requestId,
					workspaceId: ctx.auth.workspaceId,
					userId: ctx.auth.userId,
					indexName,
					namespaceName,
				});

				// Generate query embedding using workspace's embedding configuration
				const embedStart = Date.now();
				const embedding = createEmbeddingProviderForWorkspace(
					{
						id: workspace.id,
						embeddingModel: workspace.settings.embedding.embeddingModel,
						embeddingDim: workspace.settings.embedding.embeddingDim,
					},
					{
						inputType: "search_query",
					},
				);
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
				const results = await pineconeClient.query<VectorMetadata>(
					indexName,
					{
						vector: queryVector,
						topK: input.topK,
						includeMetadata: true,
					},
					namespaceName,
				);
				const queryLatency = Date.now() - queryStart;

				log.info("Pinecone query complete", {
					requestId,
					namespaceName,
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

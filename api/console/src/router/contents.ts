/**
 * Contents tRPC router
 *
 * Implements /v1/contents endpoint for fetching full documents
 */

import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { publicProcedure } from "../trpc";
import {
	ContentsRequestSchema,
	ContentsResponseSchema,
	type ContentsResponse,
} from "@repo/console-types/api";
import { db } from "@db/console/client";
import { docsDocuments, stores } from "@db/console/schema";
import { inArray, eq } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { randomUUID } from "node:crypto";

/**
 * Contents router - public procedures for document content endpoints
 */
export const contentsRouter = {
	/**
	 * Fetch endpoint - retrieve full documents by IDs
	 *
	 * @example
	 * ```typescript
	 * const result = await trpc.contents.fetch.query({
	 *   ids: ["doc_123", "doc_456"]
	 * });
	 * ```
	 */
	fetch: publicProcedure
		.input(ContentsRequestSchema)
		.output(ContentsResponseSchema)
		.query(async ({ input }): Promise<ContentsResponse> => {
			const requestId = randomUUID();

			log.info("Fetching contents", {
				requestId,
				ids: input.ids,
				count: input.ids.length,
			});

			try {
				// Phase 1.6: Fetch documents with workspace scoping via stores join
				const documents = await db
					.select({
						id: docsDocuments.id,
						path: docsDocuments.path,
						title: docsDocuments.title,
						description: docsDocuments.description,
						frontmatter: docsDocuments.frontmatter,
						committedAt: docsDocuments.committedAt,
						storeId: docsDocuments.storeId,
						workspaceId: stores.workspaceId,
					})
					.from(docsDocuments)
					.innerJoin(stores, eq(docsDocuments.storeId, stores.id))
					.where(inArray(docsDocuments.id, input.ids));

				log.info("Documents fetched", {
					requestId,
					found: documents.length,
					requested: input.ids.length,
				});

				// Map to response format
				const mappedDocs = documents.map((doc) => ({
					id: doc.id,
					path: doc.path,
					title: doc.title || null,
					description: doc.description || null,
					content: "", // TODO: Phase 2 - Fetch from storage if needed
					metadata: (doc.frontmatter as Record<string, unknown>) || {},
					committedAt: doc.committedAt.toISOString(),
				}));

				// Log any missing documents
				const foundIds = new Set(documents.map((d) => d.id));
				const missingIds = input.ids.filter((id: string) => !foundIds.has(id));
				if (missingIds.length > 0) {
					log.warn("Some documents not found", {
						requestId,
						missingIds,
					});
				}

				const response: ContentsResponse = {
					documents: mappedDocs,
					requestId,
				};

				return response;
			} catch (error) {
				log.error("Contents fetch failed", {
					requestId,
					error,
					ids: input.ids,
				});

				// Re-throw TRPCErrors
				if (error instanceof TRPCError) {
					throw error;
				}

				// Convert other errors to TRPCError
				const message = error instanceof Error ? error.message : "Failed to fetch contents";
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message,
					cause: error,
				});
			}
		}),
} satisfies TRPCRouterRecord;

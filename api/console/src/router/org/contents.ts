/**
 * Contents tRPC router
 *
 * Implements /v1/contents endpoint for fetching full documents
 */

import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { apiKeyProcedure } from "../../trpc";
import {
	ContentsRequestSchema,
	ContentsResponseSchema,
	type ContentsResponse,
} from "@repo/console-types/api";
import { db } from "@db/console/client";
import { workspaceKnowledgeDocuments } from "@db/console/schema";
import { inArray, eq, and } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { randomUUID } from "node:crypto";

/**
 * Contents router - API key protected procedures for document content endpoints
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
	fetch: apiKeyProcedure
		.input(ContentsRequestSchema)
		.output(ContentsResponseSchema)
		.query(async ({ ctx, input }): Promise<ContentsResponse> => {
			const requestId = randomUUID();

			log.info("Fetching contents", {
				requestId,
				workspaceId: ctx.auth.workspaceId,
				userId: ctx.auth.userId,
				ids: input.ids,
				count: input.ids.length,
			});

			try {
				// Fetch documents directly by workspace ID
				const documents = await db
					.select({
						id: workspaceKnowledgeDocuments.id,
						sourceType: workspaceKnowledgeDocuments.sourceType,
						sourceId: workspaceKnowledgeDocuments.sourceId,
						sourceMetadata: workspaceKnowledgeDocuments.sourceMetadata,
						workspaceId: workspaceKnowledgeDocuments.workspaceId,
					})
					.from(workspaceKnowledgeDocuments)
					.where(
						and(
							inArray(workspaceKnowledgeDocuments.id, input.ids),
							eq(workspaceKnowledgeDocuments.workspaceId, ctx.auth.workspaceId)
						)
					);

				log.info("Documents fetched", {
					requestId,
					workspaceId: ctx.auth.workspaceId,
					userId: ctx.auth.userId,
					found: documents.length,
					requested: input.ids.length,
				});

				// Map to response format, extracting data from sourceMetadata
				const mappedDocs = documents.map((doc) => {
					const metadata = (doc.sourceMetadata as Record<string, unknown>) || {};
					const frontmatter = (metadata.frontmatter as Record<string, unknown>) || {};

					// Extract path: use sourceMetadata.path (GitHub) or sourceId (other sources)
					const path = (metadata.path as string | undefined) ?? doc.sourceId;

					// Extract committedAt from sourceMetadata or use current date
					const committedAt = (metadata.committedAt as string | undefined) ?? new Date().toISOString();

					return {
						id: doc.id,
						path,
						title: (frontmatter.title as string | undefined) ?? null,
						description: (frontmatter.description as string | undefined) ?? null,
						content: "", // TODO: Phase 2 - Fetch from storage if needed
						metadata: frontmatter,
						committedAt,
					};
				});

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

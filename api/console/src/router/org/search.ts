/**
 * Search tRPC router
 *
 * Implements search using Pinecone vector search with canonical schemas.
 */

import { randomUUID } from "node:crypto";
import { db } from "@db/console/client";
import { orgWorkspaces } from "@db/console/schema";
import { createEmbeddingProviderForWorkspace } from "@repo/console-embed";
import type { VectorMetadata } from "@repo/console-pinecone";
import { pineconeClient } from "@repo/console-pinecone";
import type { SearchResponse } from "@repo/console-validation/api";
import {
  SearchRequestSchema,
  SearchResponseSchema,
} from "@repo/console-validation/api";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log";
import { eq } from "drizzle-orm";
import { apiKeyProcedure } from "../../trpc";

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
   *   limit: 10,
   *   mode: "balanced",
   * });
   * ```
   */
  query: apiKeyProcedure
    .input(SearchRequestSchema)
    .output(SearchResponseSchema)
    .query(async ({ ctx, input }): Promise<SearchResponse> => {
      const startTime = Date.now();
      const requestId = randomUUID();

      // Workspace comes from X-Workspace-ID header (API keys are now org-scoped)
      const workspaceId = ctx.headers.get("x-workspace-id");
      if (!workspaceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "X-Workspace-ID header required",
        });
      }

      log.info("Search query", {
        requestId,
        workspaceId,
        userId: ctx.auth.userId,
        query: input.query,
        limit: input.limit,
        offset: input.offset,
        mode: input.mode,
        filters: input.filters,
      });

      try {
        // Look up workspace configuration, validating org ownership
        const workspace = await db.query.orgWorkspaces.findFirst({
          where: eq(orgWorkspaces.id, workspaceId),
        });

        if (!workspace) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace not found",
          });
        }

        // Validate workspace belongs to the org from the API key
        if (workspace.clerkOrgId !== ctx.auth.orgId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Access denied to this workspace",
          });
        }

        if ((workspace.settings.version as number) !== 1) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Workspace has invalid settings",
          });
        }

        const indexName = workspace.settings.embedding.indexName;
        const namespaceName = workspace.settings.embedding.namespaceName;

        log.info("Resolved index and namespace", {
          requestId,
          workspaceId,
          userId: ctx.auth.userId,
          indexName,
          namespaceName,
        });

        // Generate query embedding using workspace's embedding configuration
        const embedding = createEmbeddingProviderForWorkspace(
          {
            id: workspace.id,
            embeddingModel: workspace.settings.embedding.embeddingModel,
            embeddingDim: workspace.settings.embedding.embeddingDim,
          },
          {
            inputType: "search_query",
          }
        );
        const { embeddings } = await embedding.embed([input.query]);

        const queryVector = embeddings[0];
        if (!queryVector) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate query embedding",
          });
        }

        // Query Pinecone
        const queryStart = Date.now();
        const results = await pineconeClient.query<VectorMetadata>(
          indexName,
          {
            vector: queryVector,
            topK: input.limit,
            includeMetadata: true,
          },
          namespaceName
        );
        const queryLatency = Date.now() - queryStart;

        log.info("Pinecone query complete", {
          requestId,
          namespaceName,
          queryLatency,
          matchCount: results.matches.length,
        });

        // Map results to canonical SearchResponse format
        const searchResults = results.matches.map((match) => ({
          id: match.id,
          title: String(match.metadata?.title ?? ""),
          source: String(match.metadata?.source ?? ""),
          type: String(match.metadata?.type ?? ""),
          url: match.metadata?.url ? String(match.metadata.url) : null,
          occurredAt: match.metadata?.occurredAt
            ? String(match.metadata.occurredAt)
            : null,
          snippet: String(match.metadata?.snippet ?? ""),
          score: match.score,
          entities: undefined,
          references: undefined,
        }));

        const response: SearchResponse = {
          data: searchResults,
          meta: {
            total: searchResults.length,
            limit: input.limit,
            offset: input.offset,
            mode: input.mode,
          },
          requestId,
        };

        log.info("Search complete", {
          requestId,
          totalLatency: Date.now() - startTime,
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
        const message =
          error instanceof Error ? error.message : "Search failed";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;

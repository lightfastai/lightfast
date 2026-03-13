/**
 * Contents tRPC router
 *
 * Implements contents endpoint for fetching full documents with canonical schemas.
 */

import { randomUUID } from "node:crypto";
import { db } from "@db/console/client";
import { orgWorkspaces, workspaceKnowledgeDocuments } from "@db/console/schema";
import type { ContentsResponse } from "@repo/console-validation/api";
import {
  ContentsRequestSchema,
  ContentsResponseSchema,
} from "@repo/console-validation/api";
import type { TRPCRouterRecord } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { log } from "@vendor/observability/log";
import { and, eq, inArray } from "drizzle-orm";
import { apiKeyProcedure } from "../../trpc";

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

      // Workspace comes from X-Workspace-ID header (API keys are now org-scoped)
      const workspaceId = ctx.headers.get("x-workspace-id");
      if (!workspaceId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "X-Workspace-ID header required",
        });
      }

      // Validate workspace belongs to the org from the API key
      const workspace = await db.query.orgWorkspaces.findFirst({
        where: eq(orgWorkspaces.id, workspaceId),
        columns: { clerkOrgId: true },
      });
      if (workspace?.clerkOrgId !== ctx.auth.orgId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Access denied to this workspace",
        });
      }

      log.info("Fetching contents", {
        requestId,
        workspaceId,
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
              eq(workspaceKnowledgeDocuments.workspaceId, workspaceId)
            )
          );

        log.info("Documents fetched", {
          requestId,
          workspaceId,
          userId: ctx.auth.userId,
          found: documents.length,
          requested: input.ids.length,
        });

        // Map to canonical ContentItem response format
        const items = documents.map((doc) => {
          const metadata = doc.sourceMetadata as Record<string, unknown>;
          const frontmatter =
            (metadata.frontmatter as Record<string, unknown> | undefined) ?? {};

          // Extract committedAt from sourceMetadata or use current date
          const committedAt =
            (metadata.committedAt as string | undefined) ??
            new Date().toISOString();

          return {
            id: doc.id,
            title: (frontmatter.title as string | undefined) ?? doc.id,
            source: doc.sourceType,
            type: (metadata.type as string | undefined) ?? doc.sourceType,
            url: (metadata.url as string | undefined) ?? null,
            occurredAt: committedAt,
            snippet: (metadata.snippet as string | undefined) ?? "",
            content: "", // TODO: Fetch from storage if needed
            metadata: frontmatter,
          };
        });

        // Track missing IDs
        const foundIds = new Set(documents.map((d) => d.id));
        const missing = input.ids.filter((id: string) => !foundIds.has(id));
        if (missing.length > 0) {
          log.warn("Some documents not found", {
            requestId,
            missing,
          });
        }

        const response: ContentsResponse = {
          data: {
            items,
            missing,
          },
          meta: {
            total: items.length,
          },
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
        const message =
          error instanceof Error ? error.message : "Failed to fetch contents";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message,
          cause: error,
        });
      }
    }),
} satisfies TRPCRouterRecord;

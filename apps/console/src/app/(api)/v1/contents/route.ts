/**
 * POST /v1/contents - Fetch Content by IDs
 *
 * Fetch full content for documents and observations.
 *
 * Authentication:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * Request body:
 * - ids: string[] (required) - Content IDs (doc_* or obs_*)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { db } from "@db/console/client";
import { workspaceKnowledgeDocuments } from "@db/console/schema";
import { and, eq, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { V1ContentsRequestSchema } from "@repo/console-types";
import type { V1ContentsResponse, V1ContentItem } from "@repo/console-types";
import { recordSystemActivity } from "@api/console/lib/activity";

import { withDualAuth, createDualAuthErrorResponse } from "../lib/with-dual-auth";
import { buildSourceUrl } from "~/lib/neural/url-builder";
import { resolveObservationsById } from "~/lib/neural/id-resolver";
import type { ResolvedObservation } from "~/lib/neural/id-resolver";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/contents request", { requestId });

  try {
    // 1. Authenticate via API key or session
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, authType } = authResult.auth;

    log.info("v1/contents authenticated", {
      requestId,
      workspaceId,
      userId,
      authType,
      apiKeyId: authResult.auth.apiKeyId,
    });

    // 2. Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_JSON", message: "Invalid JSON body", requestId },
        { status: 400 }
      );
    }

    const parseResult = V1ContentsRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid request",
          details: parseResult.error.flatten().fieldErrors,
          requestId,
        },
        { status: 400 }
      );
    }

    const { ids } = parseResult.data;

    log.info("v1/contents validated", { requestId, idCount: ids.length });

    // 3. Separate IDs by type
    // Observation IDs: either vector IDs (obs_title_*, obs_content_*, obs_summary_*) or database nanoids
    // Document IDs: doc_* prefix
    const docIds = ids.filter((id) => id.startsWith("doc_"));
    // obsIds includes both vector IDs and database IDs (anything not a doc_*)
    const obsIds = ids.filter((id) => !id.startsWith("doc_"));

    // 4. Fetch in parallel using resolver for observations
    const [observationMap, documents] = await Promise.all([
      obsIds.length > 0
        ? resolveObservationsById(workspaceId, obsIds, {
            id: true,
            title: true,
            content: true,
            source: true,
            sourceId: true,
            observationType: true,
            occurredAt: true,
            metadata: true,
          })
        : Promise.resolve(new Map<string, ResolvedObservation>()),

      docIds.length > 0
        ? db
            .select({
              id: workspaceKnowledgeDocuments.id,
              sourceType: workspaceKnowledgeDocuments.sourceType,
              sourceId: workspaceKnowledgeDocuments.sourceId,
              sourceMetadata: workspaceKnowledgeDocuments.sourceMetadata,
            })
            .from(workspaceKnowledgeDocuments)
            .where(
              and(
                eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
                inArray(workspaceKnowledgeDocuments.id, docIds)
              )
            )
        : Promise.resolve([]),
    ]);

    // 5. Map to response format
    const items: V1ContentItem[] = [
      // Observations - full content from DB, keyed by request ID (may be vector ID)
      ...Array.from(observationMap.entries()).map(([reqId, obs]) => {
        const metadata = obs.metadata ?? {};
        return {
          id: reqId, // Return the ID that was requested (may be vector ID)
          title: obs.title,
          url: buildSourceUrl(obs.source, obs.sourceId, metadata),
          snippet: obs.content.slice(0, 200),
          content: obs.content,
          source: obs.source,
          type: obs.observationType,
          occurredAt: obs.occurredAt,
          metadata,
        } satisfies V1ContentItem;
      }),

      // Documents - metadata + URL only
      ...documents.map((doc) => {
        const metadata = doc.sourceMetadata as Record<string, unknown>;
        const frontmatter = (metadata.frontmatter ?? {}) as Record<string, unknown>;
        return {
          id: doc.id,
          title: typeof frontmatter.title === "string" ? frontmatter.title : doc.sourceId,
          url: buildSourceUrl(doc.sourceType, doc.sourceId, metadata),
          snippet: typeof frontmatter.description === "string" ? frontmatter.description : "",
          // No content for documents - use URL to fetch
          source: doc.sourceType,
          type: "file",
          metadata: frontmatter,
        };
      }),
    ];

    // 6. Track missing IDs
    const foundRequestIds = new Set([
      ...observationMap.keys(),
      ...documents.map((d) => d.id),
    ]);
    const missing = ids.filter((id) => !foundRequestIds.has(id));

    if (missing.length > 0) {
      log.warn("v1/contents missing IDs", { requestId, missing });
    }

    // 7. Build response
    const response: V1ContentsResponse = {
      items,
      missing,
      requestId,
    };

    // Track contents fetch (Tier 3 - fire-and-forget for low latency)
    recordSystemActivity({
      workspaceId,
      actorType: authType === "api-key" ? "api" : "user",
      actorUserId: userId,
      category: "search",
      action: "search.contents",
      entityType: "contents_fetch",
      entityId: requestId,
      metadata: {
        requestedCount: ids.length,
        foundCount: items.length,
        missingCount: missing.length,
        latencyMs: Date.now() - startTime,
        authType,
        apiKeyId: authResult.auth.apiKeyId,
      },
    });

    log.info("v1/contents complete", {
      requestId,
      itemCount: items.length,
      missingCount: missing.length,
      latency: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("v1/contents error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to fetch contents",
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - return method not allowed
 */
export function GET() {
  return NextResponse.json(
    { error: "METHOD_NOT_ALLOWED", message: "Use POST method" },
    { status: 405 }
  );
}

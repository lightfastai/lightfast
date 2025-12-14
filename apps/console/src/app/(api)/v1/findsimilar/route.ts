/**
 * POST /v1/findsimilar - Find Similar Content
 *
 * Find content similar to a given document or observation.
 *
 * Authentication:
 * - Authorization: Bearer <api-key>
 * - X-Workspace-ID: <workspace-id>
 *
 * Request body:
 * - id: string (optional) - Content ID to find similar items for
 * - url: string (optional) - URL to find similar items for
 * - limit: number (1-50, default 10)
 * - threshold: number (0-1, default 0.5)
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";

import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceKnowledgeDocuments,
  workspaceObservationClusters,
  orgWorkspaces,
} from "@db/console/schema";
import { and, eq, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { consolePineconeClient } from "@repo/console-pinecone";
import { createEmbeddingProvider } from "@repo/console-embed";
import { V1FindSimilarRequestSchema } from "@repo/console-types";
import type { V1FindSimilarResponse, V1FindSimilarResult } from "@repo/console-types";

import { withApiKeyAuth, createAuthErrorResponse } from "../lib/with-api-key-auth";
import { resolveByUrl } from "~/lib/neural/url-resolver";
import { buildSourceUrl } from "~/lib/neural/url-builder";

interface SourceContent {
  id: string;
  title: string;
  content: string;
  type: string;
  source: string;
  clusterId: string | null;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/findsimilar request", { requestId });

  try {
    // 1. Authenticate via API key
    const authResult = await withApiKeyAuth(request, requestId);
    if (!authResult.success) {
      return createAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, apiKeyId } = authResult.auth;

    log.info("v1/findsimilar authenticated", { requestId, workspaceId, userId, apiKeyId });

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

    const parseResult = V1FindSimilarRequestSchema.safeParse(body);
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

    const { id, url, limit, threshold, sameSourceOnly, excludeIds, filters } = parseResult.data;

    // 3. Resolve source content
    let sourceId = id;
    if (!sourceId && url) {
      const resolved = await resolveByUrl(workspaceId, url);
      if (!resolved) {
        return NextResponse.json(
          { error: "NOT_FOUND", message: "URL not found in workspace", requestId },
          { status: 404 }
        );
      }
      sourceId = resolved.id;
    }

    if (!sourceId) {
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: "Either id or url must be provided", requestId },
        { status: 400 }
      );
    }

    // 4. Fetch source content
    const sourceContent = await fetchSourceContent(workspaceId, sourceId);
    if (!sourceContent) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Content not found", requestId },
        { status: 404 }
      );
    }

    // 5. Get workspace config for Pinecone
    const workspace = await db.query.orgWorkspaces.findFirst({
      columns: {
        indexName: true,
        namespaceName: true,
      },
      where: eq(orgWorkspaces.id, workspaceId),
    });

    if (!workspace?.indexName || !workspace.namespaceName) {
      return NextResponse.json(
        { error: "CONFIG_ERROR", message: "Workspace not configured for search", requestId },
        { status: 500 }
      );
    }

    // 6. Generate embedding for source content
    const provider = createEmbeddingProvider({ inputType: "search_document" });
    const embedResult = await provider.embed([sourceContent.content]);
    const embedding = embedResult.embeddings[0];
    if (!embedding) {
      return NextResponse.json(
        { error: "INTERNAL_ERROR", message: "Failed to generate embedding", requestId },
        { status: 500 }
      );
    }

    // 7. Build Pinecone filter
    const pineconeFilter: Record<string, unknown> = {
      layer: { $eq: "observations" },
    };

    if (sameSourceOnly) {
      pineconeFilter.source = { $eq: sourceContent.source };
    }

    if (filters?.sourceTypes?.length) {
      pineconeFilter.source = { $in: filters.sourceTypes };
    }

    if (filters?.observationTypes?.length) {
      pineconeFilter.observationType = { $in: filters.observationTypes };
    }

    // 8. Query Pinecone for similar vectors
    const pineconeResults = await consolePineconeClient.query(
      workspace.indexName,
      {
        vector: embedding,
        topK: limit * 2, // Over-fetch for filtering
        filter: pineconeFilter,
        includeMetadata: true,
      },
      workspace.namespaceName
    );

    // 9. Filter and process results
    const exclusions = new Set([sourceContent.id, ...(excludeIds ?? [])]);
    const filtered = pineconeResults.matches
      .filter((m) => !exclusions.has(m.id) && m.score >= threshold)
      .slice(0, limit);

    // 10. Enrich results with database info
    const resultIds = filtered.map((m) => m.id);
    const enrichedData = await enrichResults(workspaceId, resultIds, sourceContent.clusterId);

    // 11. Get cluster info for source
    let clusterInfo: { topic: string | null; memberCount: number } | undefined;
    if (sourceContent.clusterId) {
      const cluster = await db.query.workspaceObservationClusters.findFirst({
        columns: { topicLabel: true, observationCount: true },
        where: eq(workspaceObservationClusters.id, sourceContent.clusterId),
      });
      if (cluster) {
        clusterInfo = {
          topic: cluster.topicLabel,
          memberCount: cluster.observationCount,
        };
      }
    }

    // 12. Build response
    const similar: V1FindSimilarResult[] = filtered.map((match) => {
      const data = enrichedData.get(match.id);
      const metadata = (match.metadata ?? {}) as Record<string, unknown>;

      return {
        id: match.id,
        title: typeof metadata.title === "string" ? metadata.title : (data?.title ?? ""),
        url: data?.url ?? (typeof metadata.url === "string" ? metadata.url : ""),
        snippet: typeof metadata.snippet === "string" ? metadata.snippet : undefined,
        score: match.score,
        vectorSimilarity: match.score,
        entityOverlap: data?.entityOverlap,
        sameCluster: data?.sameCluster ?? false,
        source: typeof metadata.source === "string" ? metadata.source : (data?.source ?? ""),
        type:
          typeof metadata.observationType === "string"
            ? metadata.observationType
            : (data?.type ?? ""),
        occurredAt: data?.occurredAt,
      };
    });

    const response: V1FindSimilarResponse = {
      source: {
        id: sourceContent.id,
        title: sourceContent.title,
        type: sourceContent.type,
        cluster: clusterInfo,
      },
      similar,
      meta: {
        total: filtered.length,
        took: Date.now() - startTime,
        inputEmbedding: {
          found: false,
          generated: true,
        },
      },
      requestId,
    };

    log.info("v1/findsimilar complete", {
      requestId,
      sourceId: sourceContent.id,
      similarCount: similar.length,
      latency: Date.now() - startTime,
    });

    return NextResponse.json(response);
  } catch (error) {
    log.error("v1/findsimilar error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Failed to find similar content",
        requestId,
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch source content by ID (observation or document)
 */
async function fetchSourceContent(
  workspaceId: string,
  contentId: string
): Promise<SourceContent | null> {
  if (contentId.startsWith("obs_")) {
    const obs = await db.query.workspaceNeuralObservations.findFirst({
      columns: {
        id: true,
        title: true,
        content: true,
        observationType: true,
        source: true,
        clusterId: true,
      },
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.id, contentId)
      ),
    });

    if (obs) {
      return {
        id: obs.id,
        title: obs.title,
        content: obs.content,
        type: obs.observationType,
        source: obs.source,
        clusterId: obs.clusterId,
      };
    }
  }

  if (contentId.startsWith("doc_")) {
    const doc = await db.query.workspaceKnowledgeDocuments.findFirst({
      columns: {
        id: true,
        sourceId: true,
        sourceType: true,
        sourceMetadata: true,
      },
      where: and(
        eq(workspaceKnowledgeDocuments.workspaceId, workspaceId),
        eq(workspaceKnowledgeDocuments.id, contentId)
      ),
    });

    if (doc) {
      const metadata = doc.sourceMetadata as Record<string, unknown>;
      const frontmatter = (metadata.frontmatter ?? {}) as Record<string, unknown>;
      return {
        id: doc.id,
        title: typeof frontmatter.title === "string" ? frontmatter.title : doc.sourceId,
        content: typeof frontmatter.description === "string" ? frontmatter.description : "",
        type: "file",
        source: doc.sourceType,
        clusterId: null,
      };
    }
  }

  return null;
}

/**
 * Enrich results with database info
 */
async function enrichResults(
  workspaceId: string,
  resultIds: string[],
  sourceClusterId: string | null
): Promise<
  Map<
    string,
    {
      title: string;
      url: string;
      source: string;
      type: string;
      occurredAt?: string;
      sameCluster: boolean;
      entityOverlap?: number;
    }
  >
> {
  const result = new Map<
    string,
    {
      title: string;
      url: string;
      source: string;
      type: string;
      occurredAt?: string;
      sameCluster: boolean;
      entityOverlap?: number;
    }
  >();

  if (resultIds.length === 0) return result;

  // Fetch observations
  const obsIds = resultIds.filter((id) => id.startsWith("obs_"));
  if (obsIds.length > 0) {
    const observations = await db
      .select({
        id: workspaceNeuralObservations.id,
        title: workspaceNeuralObservations.title,
        source: workspaceNeuralObservations.source,
        sourceId: workspaceNeuralObservations.sourceId,
        observationType: workspaceNeuralObservations.observationType,
        occurredAt: workspaceNeuralObservations.occurredAt,
        clusterId: workspaceNeuralObservations.clusterId,
        metadata: workspaceNeuralObservations.metadata,
      })
      .from(workspaceNeuralObservations)
      .where(
        and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          inArray(workspaceNeuralObservations.id, obsIds)
        )
      );

    for (const obs of observations) {
      const metadata = (obs.metadata ?? {}) as Record<string, unknown>;
      result.set(obs.id, {
        title: obs.title,
        url: buildSourceUrl(obs.source, obs.sourceId, metadata),
        source: obs.source,
        type: obs.observationType,
        occurredAt: obs.occurredAt,
        sameCluster: sourceClusterId !== null && obs.clusterId === sourceClusterId,
      });
    }
  }

  return result;
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

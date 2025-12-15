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
  workspaceKnowledgeDocuments,
  // TODO: Phase 5 - Re-enable when clusters are migrated to BIGINT
  // workspaceObservationClusters,
} from "@db/console/schema";
import { and, eq } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { consolePineconeClient } from "@repo/console-pinecone";
import { createEmbeddingProvider } from "@repo/console-embed";
import { getCachedWorkspaceConfig } from "@repo/console-workspace-cache";
import { V1FindSimilarRequestSchema } from "@repo/console-types";
import type { V1FindSimilarResponse, V1FindSimilarResult } from "@repo/console-types";

import { withDualAuth, createDualAuthErrorResponse } from "../lib/with-dual-auth";
import { resolveByUrl } from "~/lib/neural/url-resolver";
import { buildSourceUrl } from "~/lib/neural/url-builder";
import {
  resolveObservationById,
  resolveObservationsById,
} from "~/lib/neural/id-resolver";
import { workspaceNeuralObservations } from "@db/console/schema";
import { or, inArray } from "drizzle-orm";

interface SourceContent {
  id: string;          // externalId (nanoid) for observations, doc_* for documents
  internalId?: number; // Internal BIGINT for observations
  title: string;
  content: string;
  type: string;
  source: string;
  clusterId: number | null;
}

/**
 * Normalized result with observation ID (deduplicated from multi-view vectors)
 */
interface NormalizedMatch {
  observationId: string;
  score: number;
  metadata: Record<string, unknown>;
}

/**
 * Normalize vector IDs to observation IDs and deduplicate multi-view matches.
 * Uses max score when same observation matches via multiple views.
 */
async function normalizeAndDeduplicate(
  workspaceId: string,
  matches: { id: string; score: number; metadata?: Record<string, unknown> }[],
  requestId: string
): Promise<NormalizedMatch[]> {
  if (matches.length === 0) return [];

  // Separate Phase 3 (with observationId in metadata) from legacy vectors
  const withObsId: typeof matches = [];
  const withoutObsId: typeof matches = [];

  for (const match of matches) {
    if (typeof match.metadata?.observationId === "string") {
      withObsId.push(match);
    } else {
      withoutObsId.push(match);
    }
  }

  // Group by observation ID
  const obsGroups = new Map<string, { score: number; metadata: Record<string, unknown> }>();

  // Process Phase 3 vectors (direct from metadata)
  for (const match of withObsId) {
    // We checked typeof metadata?.observationId === "string" when filtering into withObsId
    const metadata = match.metadata ?? {};
    const obsId = metadata.observationId as string;
    const existing = obsGroups.get(obsId);
    if (existing) {
      // Keep max score
      if (match.score > existing.score) {
        existing.score = match.score;
        existing.metadata = metadata;
      }
    } else {
      obsGroups.set(obsId, { score: match.score, metadata });
    }
  }

  // Process legacy vectors (database lookup)
  if (withoutObsId.length > 0) {
    const vectorIds = withoutObsId.map((m) => m.id);

    const observations = await db
      .select({
        id: workspaceNeuralObservations.id,
        externalId: workspaceNeuralObservations.externalId,
        embeddingTitleId: workspaceNeuralObservations.embeddingTitleId,
        embeddingContentId: workspaceNeuralObservations.embeddingContentId,
        embeddingSummaryId: workspaceNeuralObservations.embeddingSummaryId,
        embeddingVectorId: workspaceNeuralObservations.embeddingVectorId,
      })
      .from(workspaceNeuralObservations)
      .where(
        and(
          eq(workspaceNeuralObservations.workspaceId, workspaceId),
          or(
            inArray(workspaceNeuralObservations.embeddingTitleId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingContentId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingSummaryId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingVectorId, vectorIds)
          )
        )
      );

    // Build vector ID → externalId mapping (use externalId for public API)
    const vectorToObs = new Map<string, string>();
    for (const obs of observations) {
      if (obs.embeddingTitleId) vectorToObs.set(obs.embeddingTitleId, obs.externalId);
      if (obs.embeddingContentId) vectorToObs.set(obs.embeddingContentId, obs.externalId);
      if (obs.embeddingSummaryId) vectorToObs.set(obs.embeddingSummaryId, obs.externalId);
      if (obs.embeddingVectorId) vectorToObs.set(obs.embeddingVectorId, obs.externalId);
    }

    // Add legacy matches to groups
    for (const match of withoutObsId) {
      const obsId = vectorToObs.get(match.id);
      if (!obsId) {
        log.warn("Vector ID not found in database", { vectorId: match.id, requestId });
        continue;
      }

      const existing = obsGroups.get(obsId);
      if (existing) {
        if (match.score > existing.score) {
          existing.score = match.score;
          existing.metadata = match.metadata ?? {};
        }
      } else {
        obsGroups.set(obsId, { score: match.score, metadata: match.metadata ?? {} });
      }
    }
  }

  // Convert to array and sort by score
  const results: NormalizedMatch[] = [];
  for (const [obsId, data] of obsGroups) {
    results.push({
      observationId: obsId,
      score: data.score,
      metadata: data.metadata,
    });
  }

  results.sort((a, b) => b.score - a.score);

  log.info("findsimilar normalized", {
    requestId,
    inputCount: matches.length,
    outputCount: results.length,
    phase3Direct: withObsId.length,
    phase2Lookup: withoutObsId.length,
  });

  return results;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = randomUUID();

  log.info("v1/findsimilar request", { requestId });

  try {
    // 1. Authenticate via API key or session
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId, userId, authType } = authResult.auth;

    log.info("v1/findsimilar authenticated", {
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

    // 5. Get workspace config and generate embedding in parallel
    const [workspace, embedResult] = await Promise.all([
      getCachedWorkspaceConfig(workspaceId),
      (async () => {
        const provider = createEmbeddingProvider({ inputType: "search_document" });
        return provider.embed([sourceContent.content]);
      })(),
    ]);

    // 6. Validate results
    if (!workspace) {
      return NextResponse.json(
        { error: "CONFIG_ERROR", message: "Workspace not configured for search", requestId },
        { status: 500 }
      );
    }

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
        topK: limit * 3, // Over-fetch more to account for multi-view deduplication
        filter: pineconeFilter,
        includeMetadata: true,
      },
      workspace.namespaceName
    );

    // 9. Normalize vector IDs to observation IDs and deduplicate multi-view matches
    const normalizedResults = await normalizeAndDeduplicate(
      workspaceId,
      pineconeResults.matches as { id: string; score: number; metadata?: Record<string, unknown> }[],
      requestId
    );

    // 10. Filter by observation ID and apply threshold
    const exclusions = new Set([sourceContent.id, ...(excludeIds ?? [])]);
    const filtered = normalizedResults
      .filter((m) => !exclusions.has(m.observationId) && m.score >= threshold)
      .slice(0, limit);

    // 11. Enrich results with database info (using observation IDs)
    const resultIds = filtered.map((m) => m.observationId);
    const enrichedData = await enrichResults(workspaceId, resultIds, sourceContent.clusterId);

    // 12. Get cluster info for source
    // TODO: Phase 5 will enable this when clusters are migrated to BIGINT
    // Currently, observations.clusterId is BIGINT but clusters.id is varchar
    // Since clusterId is null for all observations until Phase 5, this code path is dormant
    let clusterInfo: { topic: string | null; memberCount: number } | undefined;
    // Skip cluster lookup until Phase 5 migrates clusters to BIGINT
    // The clusterId in observations is now BIGINT, but cluster table still uses varchar IDs
    // if (sourceContent.clusterId) { ... }

    // 13. Build response
    const similar: V1FindSimilarResult[] = filtered.map((match) => {
      const data = enrichedData.get(match.observationId);
      const metadata = match.metadata;

      return {
        id: match.observationId, // Return observation ID, not vector ID
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
 * Supports both database IDs and Pinecone vector IDs.
 */
async function fetchSourceContent(
  workspaceId: string,
  contentId: string
): Promise<SourceContent | null> {
  // Handle documents first (always doc_* prefix)
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
    return null;
  }

  // Handle observations (both externalIds and vector IDs)
  const obs = await resolveObservationById(workspaceId, contentId, {
    id: true,
    externalId: true,
    title: true,
    content: true,
    observationType: true,
    source: true,
    clusterId: true,
  });

  if (obs) {
    return {
      id: obs.externalId, // Return externalId (nanoid) for public API
      internalId: obs.id, // Keep internal BIGINT for reference
      title: obs.title,
      content: obs.content,
      type: obs.observationType,
      source: obs.source,
      clusterId: obs.clusterId,
    };
  }

  return null;
}

/**
 * Enrich results with database info
 * Supports both externalIds (nanoids) and Pinecone vector IDs.
 */
async function enrichResults(
  workspaceId: string,
  resultIds: string[],
  sourceClusterId: number | null
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

  // Filter to observation IDs (externalIds and vector IDs - anything not doc_*)
  const obsIds = resultIds.filter((id) => !id.startsWith("doc_"));
  if (obsIds.length === 0) return result;

  // Use resolver to handle both ID formats
  const observationMap = await resolveObservationsById(workspaceId, obsIds, {
    id: true,
    externalId: true,
    title: true,
    source: true,
    sourceId: true,
    observationType: true,
    occurredAt: true,
    clusterId: true,
    metadata: true,
  });

  for (const [requestId, obs] of observationMap) {
    const metadata = obs.metadata ?? {};
    result.set(requestId, {
      title: obs.title,
      url: buildSourceUrl(obs.source, obs.sourceId, metadata),
      source: obs.source,
      type: obs.observationType,
      occurredAt: obs.occurredAt,
      sameCluster: sourceClusterId !== null && obs.clusterId === sourceClusterId,
    });
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

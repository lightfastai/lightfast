 

import { db } from "@db/console/client";
import { workspaceNeuralObservations, workspaceKnowledgeDocuments } from "@db/console/schema";
import { and, eq, or, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { consolePineconeClient } from "@repo/console-pinecone";
import { createEmbeddingProvider } from "@repo/console-embed";
import { getCachedWorkspaceConfig } from "@repo/console-workspace-cache";
import type { V1FindSimilarResponse, V1FindSimilarResult } from "@repo/console-types";
import { recordSystemActivity } from "@api/console/lib/activity";

import { resolveByUrl } from "~/lib/neural/url-resolver";
import { buildSourceUrl } from "~/lib/neural/url-builder";
import {
  resolveObservationById,
  resolveObservationsById,
} from "~/lib/neural/id-resolver";
import type { V1AuthContext } from "./types";

interface SourceContent {
  id: string;
  internalId?: number;
  title: string;
  content: string;
  type: string;
  source: string;
  clusterId: number | null;
}

interface NormalizedMatch {
  observationId: string;
  score: number;
  metadata: Record<string, unknown>;
}

export interface FindSimilarLogicInput {
  id?: string;
  url?: string;
  limit: number;
  threshold: number;
  sameSourceOnly?: boolean;
  excludeIds?: string[];
  filters?: { sourceTypes?: string[]; observationTypes?: string[] };
  requestId: string;
}

export type FindSimilarLogicOutput = V1FindSimilarResponse;

// Helper function: normalize vector IDs to observation IDs
async function normalizeAndDeduplicate(
  workspaceId: string,
  matches: { id: string; score: number; metadata?: Record<string, unknown> }[],
  requestId: string
): Promise<NormalizedMatch[]> {
  if (matches.length === 0) return [];

  const withObsId: typeof matches = [];
  const withoutObsId: typeof matches = [];

  for (const match of matches) {
    if (typeof match.metadata?.observationId === "string") {
      withObsId.push(match);
    } else {
      withoutObsId.push(match);
    }
  }

  const obsGroups = new Map<string, { score: number; metadata: Record<string, unknown> }>();

  for (const match of withObsId) {
    const metadata = match.metadata ?? {};
    const obsId = metadata.observationId as string;
    const existing = obsGroups.get(obsId);
    if (existing) {
      if (match.score > existing.score) {
        existing.score = match.score;
        existing.metadata = metadata;
      }
    } else {
      obsGroups.set(obsId, { score: match.score, metadata });
    }
  }

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

    const vectorToObs = new Map<string, string>();
    for (const obs of observations) {
      if (obs.embeddingTitleId) vectorToObs.set(obs.embeddingTitleId, obs.externalId);
      if (obs.embeddingContentId) vectorToObs.set(obs.embeddingContentId, obs.externalId);
      if (obs.embeddingSummaryId) vectorToObs.set(obs.embeddingSummaryId, obs.externalId);
      if (obs.embeddingVectorId) vectorToObs.set(obs.embeddingVectorId, obs.externalId);
    }

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

  const results: NormalizedMatch[] = [];
  for (const [obsId, data] of obsGroups) {
    results.push({
      observationId: obsId,
      score: data.score,
      metadata: data.metadata,
    });
  }

  results.sort((a, b) => b.score - a.score);

  return results;
}

// Helper function: fetch source content
async function fetchSourceContent(
  workspaceId: string,
  contentId: string
): Promise<SourceContent | null> {
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
      id: obs.externalId,
      internalId: obs.id,
      title: obs.title,
      content: obs.content,
      type: obs.observationType,
      source: obs.source,
      clusterId: obs.clusterId,
    };
  }

  return null;
}

// Helper function: enrich results
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

  const obsIds = resultIds.filter((id) => !id.startsWith("doc_"));
  if (obsIds.length === 0) return result;

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

export async function findsimilarLogic(
  auth: V1AuthContext,
  input: FindSimilarLogicInput,
): Promise<FindSimilarLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/findsimilar logic executing", { requestId: input.requestId });

  // Resolve source content
  let sourceId = input.id;
  if (!sourceId && input.url) {
    const resolved = await resolveByUrl(auth.workspaceId, input.url);
    if (!resolved) {
      throw new Error(`URL not found in workspace: ${input.url}`);
    }
    sourceId = resolved.id;
  }

  if (!sourceId) {
    throw new Error("Either id or url must be provided");
  }

  // Fetch source content
  const sourceContent = await fetchSourceContent(auth.workspaceId, sourceId);
  if (!sourceContent) {
    throw new Error(`Content not found: ${sourceId}`);
  }

  // Get workspace config and generate embedding in parallel
  const [workspace, embedResult] = await Promise.all([
    getCachedWorkspaceConfig(auth.workspaceId),
    (async () => {
      const provider = createEmbeddingProvider({ inputType: "search_document" });
      return provider.embed([sourceContent.content]);
    })(),
  ]);

  if (!workspace) {
    throw new Error("Workspace not configured for search");
  }

  const embedding = embedResult.embeddings[0];
  if (!embedding) {
    throw new Error("Failed to generate embedding");
  }

  // Build Pinecone filter
  const pineconeFilter: Record<string, unknown> = {
    layer: { $eq: "observations" },
  };

  if (input.sameSourceOnly) {
    pineconeFilter.source = { $eq: sourceContent.source };
  }

  if (input.filters?.sourceTypes?.length) {
    pineconeFilter.source = { $in: input.filters.sourceTypes };
  }

  if (input.filters?.observationTypes?.length) {
    pineconeFilter.observationType = { $in: input.filters.observationTypes };
  }

  // Query Pinecone
  const pineconeResults = await consolePineconeClient.query(
    workspace.indexName,
    {
      vector: embedding,
      topK: input.limit * 3,
      filter: pineconeFilter,
      includeMetadata: true,
    },
    workspace.namespaceName
  );

  // Normalize vector IDs to observation IDs
  const normalizedResults = await normalizeAndDeduplicate(
    auth.workspaceId,
    pineconeResults.matches as { id: string; score: number; metadata?: Record<string, unknown> }[],
    input.requestId
  );

  // Filter by observation ID and apply threshold
  const exclusions = new Set([sourceContent.id, ...(input.excludeIds ?? [])]);
  const filtered = normalizedResults
    .filter((m) => !exclusions.has(m.observationId) && m.score >= input.threshold)
    .slice(0, input.limit);

  // Enrich results
  const resultIds = filtered.map((m) => m.observationId);
  const enrichedData = await enrichResults(auth.workspaceId, resultIds, sourceContent.clusterId);

  // Build response
  const similar: V1FindSimilarResult[] = filtered.map((match) => {
    const data = enrichedData.get(match.observationId);
    const metadata = match.metadata;

    return {
      id: match.observationId,
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

  // Track activity
  recordSystemActivity({
    workspaceId: auth.workspaceId,
    actorType: auth.authType === "api-key" ? "api" : "user",
    actorUserId: auth.userId,
    category: "search",
    action: "search.findsimilar",
    entityType: "findsimilar_query",
    entityId: input.requestId,
    metadata: {
      sourceId: sourceContent.id,
      sourceType: sourceContent.type,
      inputMethod: input.id ? "id" : "url",
      limit: input.limit,
      threshold: input.threshold,
      similarCount: similar.length,
      latencyMs: Date.now() - startTime,
      authType: auth.authType,
      apiKeyId: auth.apiKeyId,
    },
  });

  log.debug("v1/findsimilar logic complete", {
    requestId: input.requestId,
    sourceId: sourceContent.id,
    similarCount: similar.length,
  });

  return {
    source: {
      id: sourceContent.id,
      title: sourceContent.title,
      type: sourceContent.type,
      cluster: undefined,
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
    requestId: input.requestId,
  };
}

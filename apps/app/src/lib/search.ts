import { db } from "@db/app/client";
import { orgWorkspaces } from "@db/app/schema";
import { createEmbeddingProviderForWorkspace } from "@repo/app-embed";
import { consolePineconeClient } from "@repo/app-pinecone";
import type {
  EntityVectorMetadata,
  SearchRequest,
  SearchResponse,
} from "@repo/app-validation";
import { log } from "@vendor/observability/log/next";
import { eq } from "drizzle-orm";
import type { AuthContext } from "./types";

export async function searchLogic(
  auth: AuthContext,
  request: SearchRequest,
  requestId: string
): Promise<SearchResponse> {
  const startTime = Date.now();
  const workspace = await db.query.orgWorkspaces.findFirst({
    where: eq(orgWorkspaces.id, auth.workspaceId),
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${auth.workspaceId}`);
  }

  if ((workspace.settings.version as number) !== 1) {
    throw new Error(`Workspace ${auth.workspaceId} has invalid settings`);
  }

  const { indexName, namespaceName, embeddingModel, embeddingDim } =
    workspace.settings.embedding;

  // Embed the search query
  const embeddingProvider = createEmbeddingProviderForWorkspace(
    { id: workspace.id, embeddingModel, embeddingDim },
    { inputType: "search_query" }
  );
  const { embeddings } = await embeddingProvider.embed([request.query]);
  const queryVector = embeddings[0];

  if (!queryVector) {
    throw new Error("Failed to generate query embedding");
  }

  // Build Pinecone filter — occurredAt is stored as Unix ms number
  const pineconeFilter: Record<string, unknown> = { layer: "entities" };

  const dateFilter: Record<string, unknown> = {};
  if (request.filters?.dateRange?.start) {
    dateFilter.$gte = new Date(request.filters.dateRange.start).getTime();
  }
  if (request.filters?.dateRange?.end) {
    dateFilter.$lte = new Date(request.filters.dateRange.end).getTime();
  }
  if (Object.keys(dateFilter).length > 0) {
    pineconeFilter.occurredAt = dateFilter;
  }

  if (request.filters?.sources?.length) {
    pineconeFilter.provider = { $in: request.filters.sources };
  }

  if (request.filters?.entityTypes?.length) {
    pineconeFilter.entityType = { $in: request.filters.entityTypes };
  }

  // Query entity vectors — one result per entity (no duplicate events for same entity)
  const queryResult = await consolePineconeClient.query<EntityVectorMetadata>(
    indexName,
    {
      vector: queryVector,
      topK: request.limit,
      filter: pineconeFilter,
      includeMetadata: true,
    },
    namespaceName
  );

  log.info("Search complete", {
    requestId,
    query: request.query,
    resultCount: queryResult.matches.length,
  });

  // Map entity vector metadata to SearchResponse format
  const data = queryResult.matches.map((match) => ({
    id: String(match.metadata?.entityExternalId ?? match.id),
    title: String(match.metadata?.title ?? ""),
    source: String(match.metadata?.provider ?? ""),
    type: String(match.metadata?.entityType ?? ""),
    url: null,
    // occurredAt stored as Unix ms — convert to ISO datetime string
    occurredAt:
      match.metadata?.occurredAt != null
        ? new Date(Number(match.metadata.occurredAt)).toISOString()
        : null,
    snippet: String(match.metadata?.snippet ?? ""),
    score: match.score ?? 0,
    latestAction: match.metadata?.latestAction || undefined,
    totalEvents:
      match.metadata?.totalEvents != null
        ? Number(match.metadata.totalEvents)
        : undefined,
    significanceScore:
      match.metadata?.significanceScore != null
        ? Number(match.metadata.significanceScore)
        : undefined,
    entities: undefined,
    references: undefined,
  }));

  return {
    data,
    meta: {
      total: data.length,
      limit: request.limit,
      offset: request.offset,
      took: Date.now() - startTime,
      mode: request.mode,
      paths: { vector: true, entity: false, cluster: false },
    },
    requestId,
  };
}

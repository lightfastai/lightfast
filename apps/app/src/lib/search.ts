import { buildOrgNamespace } from "@db/app/utils";
import { createEmbeddingProvider } from "@repo/app-embed";
import { lightfastPineconeClient } from "@repo/app-pinecone";
import type { RerankCandidate } from "@repo/app-rerank";
import { createRerankProvider } from "@repo/app-rerank";
import type {
  EntityVectorMetadata,
  SearchRequest,
  SearchResponse,
} from "@repo/app-validation";
import { EMBEDDING_DEFAULTS } from "@repo/app-validation/constants";
import { log } from "@vendor/observability/log/next";
import type { AuthContext } from "./types";

export async function searchLogic(
  auth: AuthContext,
  request: SearchRequest,
  requestId: string
): Promise<SearchResponse> {
  const indexName = EMBEDDING_DEFAULTS.indexName;
  const namespaceName = buildOrgNamespace(auth.clerkOrgId);

  const embeddingProvider = createEmbeddingProvider({
    inputType: "search_query",
  });
  const { embeddings } = await embeddingProvider.embed([request.query]);
  const queryVector = embeddings[0];

  if (!queryVector) {
    throw new Error("Failed to generate query embedding");
  }

  log.debug("Query embedding generated", {
    vectorDimension: queryVector.length,
  });

  // Build Pinecone filter — occurredAt is stored as Unix ms number
  const pineconeFilter: Record<string, unknown> = { layer: "entities" };

  if (request.after) {
    pineconeFilter.occurredAt = {
      ...((pineconeFilter.occurredAt as Record<string, unknown>) ?? {}),
      $gte: new Date(request.after).getTime(),
    };
  }
  if (request.before) {
    pineconeFilter.occurredAt = {
      ...((pineconeFilter.occurredAt as Record<string, unknown>) ?? {}),
      $lte: new Date(request.before).getTime(),
    };
  }

  if (request.sources?.length) {
    pineconeFilter.provider = { $in: request.sources };
  }

  if (request.types?.length) {
    pineconeFilter.entityType = { $in: request.types };
  }

  log.debug("Pinecone filter built", { filter: pineconeFilter });

  // Query entity vectors — fetch more than limit so reranker has candidates to work with
  const topK =
    request.mode === "balanced"
      ? Math.min(request.limit * 3, 100)
      : request.limit;

  log.debug("Querying Pinecone", {
    topK,
    mode: request.mode,
    index: indexName,
  });

  const queryResult = await lightfastPineconeClient.query<EntityVectorMetadata>(
    indexName,
    {
      vector: queryVector,
      topK,
      filter: pineconeFilter,
      includeMetadata: true,
    },
    namespaceName
  );

  log.info("Pinecone query complete", {
    matchCount: queryResult.matches.length,
    topK,
  });

  // Build rerank candidates from Pinecone matches
  const candidates: RerankCandidate[] = queryResult.matches.map((match) => ({
    id: String(match.metadata?.entityExternalId ?? match.id),
    title: String(match.metadata?.title ?? ""),
    content: String(match.metadata?.snippet ?? ""),
    score: match.score ?? 0,
  }));

  log.debug("Rerank candidates prepared", {
    candidateCount: candidates.length,
  });

  const rerankProvider = createRerankProvider(request.mode);
  const rerankResponse = await rerankProvider.rerank(
    request.query,
    candidates,
    {
      topK: request.limit,
      requestId,
    }
  );

  log.debug("Reranking complete", {
    rerankResultCount: rerankResponse.results.length,
  });

  // Build lookup map for metadata from original Pinecone matches
  const matchById = new Map(
    queryResult.matches.map((m) => [
      String(m.metadata?.entityExternalId ?? m.id),
      m,
    ])
  );

  const results = rerankResponse.results.map((r) => {
    const match = matchById.get(r.id);
    const meta = match?.metadata;
    return {
      id: r.id,
      title: String(meta?.title ?? ""),
      snippet: String(meta?.snippet ?? ""),
      score: r.score,
      source: String(meta?.provider ?? ""),
      type: String(meta?.entityType ?? ""),
      url: null as string | null,
      occurredAt:
        meta?.occurredAt != null
          ? new Date(Number(meta.occurredAt)).toISOString()
          : null,
    };
  });

  return {
    results,
    total: results.length,
    requestId,
  };
}

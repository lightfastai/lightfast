import { and, eq, inArray } from "drizzle-orm";
import { db } from "@db/console/client";
import { workspaceObservationClusters } from "@db/console/schema";
import { consolePineconeClient } from "@repo/console-pinecone";

export interface ClusterSearchResult {
  clusterId: number;  // BIGINT internal ID
  topicLabel: string;
  summary: string | null;
  keywords: string[];
  score: number;
  observationCount: number;
}

/**
 * Search for relevant clusters based on query embedding
 * Queries Pinecone for cluster centroids and enriches with database metadata
 */
export async function searchClusters(
  workspaceId: string,
  indexName: string,
  namespace: string,
  queryEmbedding: number[],
  topK = 3
): Promise<{ results: ClusterSearchResult[]; latency: number }> {
  const startTime = Date.now();

  try {
    // 1. Query Pinecone for similar cluster centroids
    const pineconeResults = await consolePineconeClient.query(
      indexName,
      {
        vector: queryEmbedding,
        topK,
        filter: { layer: { $eq: "clusters" } },
        includeMetadata: true,
      },
      namespace
    );

    if (pineconeResults.matches.length === 0) {
      return { results: [], latency: Date.now() - startTime };
    }

    // 2. Extract cluster IDs from vector IDs (format: cluster_{nanoid})
    const clusterEmbeddingIds = pineconeResults.matches.map((m) => m.id);

    // 3. Fetch cluster metadata from database
    const clusters = await db
      .select({
        id: workspaceObservationClusters.id,
        topicLabel: workspaceObservationClusters.topicLabel,
        summary: workspaceObservationClusters.summary,
        keywords: workspaceObservationClusters.keywords,
        observationCount: workspaceObservationClusters.observationCount,
        topicEmbeddingId: workspaceObservationClusters.topicEmbeddingId,
      })
      .from(workspaceObservationClusters)
      .where(
        and(
          eq(workspaceObservationClusters.workspaceId, workspaceId),
          inArray(workspaceObservationClusters.topicEmbeddingId, clusterEmbeddingIds)
        )
      );

    // 4. Merge Pinecone scores with database metadata
    const results: ClusterSearchResult[] = clusters.map((cluster) => {
      const pineconeMatch = pineconeResults.matches.find(
        (m) => m.id === cluster.topicEmbeddingId
      );

      return {
        clusterId: cluster.id,
        topicLabel: cluster.topicLabel,
        summary: cluster.summary,
        keywords: cluster.keywords ?? [],
        score: pineconeMatch?.score ?? 0,
        observationCount: cluster.observationCount,
      };
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return {
      results,
      latency: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Cluster search failed:", error);
    // Graceful degradation: return empty results on error
    return { results: [], latency: Date.now() - startTime };
  }
}

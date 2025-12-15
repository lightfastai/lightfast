/**
 * Cluster Assignment for Neural Observations
 *
 * Groups observations into topic clusters based on:
 * 1. Embedding similarity to cluster centroids (0-40 points)
 * 2. Entity overlap (0-30 points)
 * 3. Actor overlap (0-20 points)
 * 4. Temporal proximity (0-10 points)
 *
 * Threshold: 60/100 to join existing cluster
 */

import { db } from "@db/console/client";
import { workspaceObservationClusters } from "@db/console/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { consolePineconeClient } from "@repo/console-pinecone";
import { log } from "@vendor/observability/log";
import { nanoid } from "@repo/lib";
import { differenceInHours, subDays } from "date-fns";

const CLUSTER_AFFINITY_THRESHOLD = 60;
const MAX_RECENT_CLUSTERS = 10;
const CLUSTER_LOOKBACK_DAYS = 7;

interface ClusterAssignmentInput {
  workspaceId: string;
  embeddingVector: number[];
  vectorId: string;
  topics: string[];
  entityIds: string[];
  actorId: string | null;
  occurredAt: string;
  title: string;
  indexName: string;
  namespace: string;
}

interface ClusterAssignmentResult {
  clusterId: number;
  isNew: boolean;
  affinityScore: number | null;
}

/**
 * Assign observation to a cluster (existing or new)
 */
export async function assignToCluster(
  input: ClusterAssignmentInput
): Promise<ClusterAssignmentResult> {
  const { workspaceId, entityIds, actorId, occurredAt } = input;

  // 1. Get recent open clusters
  const recentClusters = await db
    .select()
    .from(workspaceObservationClusters)
    .where(
      and(
        eq(workspaceObservationClusters.workspaceId, workspaceId),
        eq(workspaceObservationClusters.status, "open"),
        gte(
          workspaceObservationClusters.lastObservationAt,
          subDays(new Date(), CLUSTER_LOOKBACK_DAYS).toISOString()
        )
      )
    )
    .orderBy(desc(workspaceObservationClusters.lastObservationAt))
    .limit(MAX_RECENT_CLUSTERS);

  if (recentClusters.length === 0) {
    // No recent clusters - create new
    return createNewCluster(input);
  }

  // 2. Calculate affinity scores
  const affinities = await Promise.all(
    recentClusters.map(async (cluster) => ({
      cluster,
      score: await calculateClusterAffinity(cluster, input),
    }))
  );

  // 3. Find best match above threshold
  const bestMatch = affinities
    .filter((a) => a.score >= CLUSTER_AFFINITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0];

  if (bestMatch) {
    // Add to existing cluster
    await updateClusterMetrics(bestMatch.cluster.id, {
      entityIds,
      actorId,
      occurredAt,
    });

    log.info("Observation assigned to existing cluster", {
      clusterId: bestMatch.cluster.id,
      affinityScore: bestMatch.score,
      topicLabel: bestMatch.cluster.topicLabel,
    });

    return {
      clusterId: bestMatch.cluster.id,
      isNew: false,
      affinityScore: bestMatch.score,
    };
  }

  // 4. Create new cluster
  return createNewCluster(input);
}

/**
 * Calculate affinity score between observation and cluster
 * Max score: 100 (40 embedding + 30 entity + 20 actor + 10 temporal)
 */
async function calculateClusterAffinity(
  cluster: typeof workspaceObservationClusters.$inferSelect,
  input: ClusterAssignmentInput
): Promise<number> {
  let score = 0;

  // 1. Embedding similarity (0-40 points)
  // Query Pinecone for similarity between observation vector and cluster centroid
  if (cluster.topicEmbeddingId) {
    try {
      const similarity = await getEmbeddingSimilarity(
        input.indexName,
        input.namespace,
        input.embeddingVector,
        cluster.topicEmbeddingId
      );
      score += similarity * 40;
    } catch (error) {
      log.warn("Failed to calculate embedding similarity", {
        clusterId: cluster.id,
        error,
      });
      // Continue without embedding score
    }
  }

  // 2. Entity overlap (0-30 points)
  const clusterEntities = cluster.primaryEntities ?? [];
  const observationEntities = input.entityIds;
  const entityOverlap = calculateOverlap(clusterEntities, observationEntities);
  score += entityOverlap * 30;

  // 3. Actor overlap (0-20 points)
  const clusterActors = cluster.primaryActors ?? [];
  if (input.actorId && clusterActors.includes(input.actorId)) {
    score += 20;
  }

  // 4. Temporal proximity (0-10 points)
  // Decay: full points if < 1 hour, linear decay to 0 at 10+ hours
  if (cluster.lastObservationAt) {
    const hoursSince = differenceInHours(
      new Date(input.occurredAt),
      new Date(cluster.lastObservationAt)
    );
    score += Math.max(0, 10 - hoursSince);
  }

  return score;
}

/**
 * Get cosine similarity between observation embedding and cluster centroid
 */
async function getEmbeddingSimilarity(
  indexName: string,
  namespace: string,
  observationVector: number[],
  clusterCentroidId: string
): Promise<number> {
  // Query Pinecone with the observation vector, filtering to the cluster centroid
  // The score returned is cosine similarity (0-1)
  const results = await consolePineconeClient.query(
    indexName,
    {
      vector: observationVector,
      topK: 1,
      filter: { layer: { $eq: "clusters" } },
      includeMetadata: false,
    },
    namespace
  );

  // Find the centroid in results
  const centroidMatch = results.matches.find((m) => m.id === clusterCentroidId);
  return centroidMatch?.score ?? 0;
}

/**
 * Calculate Jaccard overlap between two arrays
 */
function calculateOverlap(arr1: string[], arr2: string[]): number {
  if (arr1.length === 0 || arr2.length === 0) return 0;

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);
  const intersection = [...set1].filter((x) => set2.has(x)).length;
  const union = new Set([...arr1, ...arr2]).size;

  return union > 0 ? intersection / union : 0;
}

/**
 * Create a new cluster for the observation
 */
async function createNewCluster(
  input: ClusterAssignmentInput
): Promise<ClusterAssignmentResult> {
  const { workspaceId, topics, title, entityIds, actorId, occurredAt } = input;
  const { embeddingVector, indexName, namespace } = input;

  // Generate topic label from first topic or title
  const topicLabel = topics[0] ?? title.slice(0, 100);

  // Create cluster centroid embedding ID
  const centroidId = `cluster_${nanoid()}`;

  // Upsert centroid to Pinecone
  await consolePineconeClient.upsertVectors(
    indexName,
    {
      ids: [centroidId],
      vectors: [embeddingVector],
      metadata: [{ layer: "clusters", topicLabel }],
    },
    namespace
  );

  // Insert cluster record
  const [cluster] = await db
    .insert(workspaceObservationClusters)
    .values({
      workspaceId,
      topicLabel,
      topicEmbeddingId: centroidId,
      keywords: topics,
      primaryEntities: entityIds,
      primaryActors: actorId ? [actorId] : [],
      status: "open",
      observationCount: 1,
      firstObservationAt: occurredAt,
      lastObservationAt: occurredAt,
    })
    .returning();

  if (!cluster) {
    throw new Error("Failed to create cluster");
  }

  log.info("Created new cluster", {
    clusterId: cluster.id,
    topicLabel,
    workspaceId,
  });

  return {
    clusterId: cluster.id,
    isNew: true,
    affinityScore: null,
  };
}

/**
 * Update cluster metrics when observation is added
 */
async function updateClusterMetrics(
  clusterId: number,
  observation: {
    entityIds: string[];
    actorId: string | null;
    occurredAt: string;
  }
): Promise<void> {
  const cluster = await db.query.workspaceObservationClusters.findFirst({
    where: eq(workspaceObservationClusters.id, clusterId),
  });

  if (!cluster) return;

  // Merge entities and actors
  const existingEntities = cluster.primaryEntities ?? [];
  const existingActors = cluster.primaryActors ?? [];

  const updatedEntities = [
    ...new Set([...existingEntities, ...observation.entityIds]),
  ].slice(0, 20); // Limit to 20 primary entities

  const updatedActors = observation.actorId
    ? [...new Set([...existingActors, observation.actorId])].slice(0, 10)
    : existingActors;

  await db
    .update(workspaceObservationClusters)
    .set({
      primaryEntities: updatedEntities,
      primaryActors: updatedActors,
      observationCount: sql`${workspaceObservationClusters.observationCount} + 1`,
      lastObservationAt: observation.occurredAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(workspaceObservationClusters.id, clusterId));
}

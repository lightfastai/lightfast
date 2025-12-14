/**
 * Test Data Verifier
 *
 * Verifies test data was processed correctly by the workflow.
 * Checks database state and Pinecone vector counts.
 */

import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceNeuralEntities,
  workspaceObservationClusters,
  workspaceActorProfiles,
} from "@db/console/schema";
import { eq, count, sql, and } from "drizzle-orm";
import { consolePineconeClient } from "@repo/console-pinecone";

export interface WorkflowVerificationResult {
  database: {
    observations: number;
    entities: number;
    clusters: number;
    actorProfiles: number;
    observationsByType: Record<string, number>;
    entitiesByCategory: Record<string, number>;
  };
  pinecone: {
    titleVectors: number;
    contentVectors: number;
    summaryVectors: number;
  };
  health: {
    multiViewComplete: boolean;  // All observations have 3 embeddings
    entitiesExtracted: boolean;  // At least some entities found
    clustersAssigned: boolean;   // Observations assigned to clusters
  };
}

export interface VerifyOptions {
  workspaceId: string;
  clerkOrgId: string;
  indexName: string;
}

/**
 * Verify test data was processed correctly by the workflow
 */
export const verify = async (options: VerifyOptions): Promise<WorkflowVerificationResult> => {
  const { workspaceId, clerkOrgId, indexName } = options;

  // Database counts
  const [obsCount] = await db
    .select({ count: count() })
    .from(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId));

  const [entityCount] = await db
    .select({ count: count() })
    .from(workspaceNeuralEntities)
    .where(eq(workspaceNeuralEntities.workspaceId, workspaceId));

  const [clusterCount] = await db
    .select({ count: count() })
    .from(workspaceObservationClusters)
    .where(eq(workspaceObservationClusters.workspaceId, workspaceId));

  const [profileCount] = await db
    .select({ count: count() })
    .from(workspaceActorProfiles)
    .where(eq(workspaceActorProfiles.workspaceId, workspaceId));

  // Observations by type
  const obsByType = await db
    .select({ type: workspaceNeuralObservations.observationType, count: count() })
    .from(workspaceNeuralObservations)
    .where(eq(workspaceNeuralObservations.workspaceId, workspaceId))
    .groupBy(workspaceNeuralObservations.observationType);

  // Entities by category
  const entsByCategory = await db
    .select({ category: workspaceNeuralEntities.category, count: count() })
    .from(workspaceNeuralEntities)
    .where(eq(workspaceNeuralEntities.workspaceId, workspaceId))
    .groupBy(workspaceNeuralEntities.category);

  // Check multi-view embedding completeness
  const [obsWithAllEmbeddings] = await db
    .select({ count: count() })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        sql`${workspaceNeuralObservations.embeddingTitleId} IS NOT NULL`,
        sql`${workspaceNeuralObservations.embeddingContentId} IS NOT NULL`,
        sql`${workspaceNeuralObservations.embeddingSummaryId} IS NOT NULL`
      )
    );

  // Check cluster assignments
  const [obsWithClusters] = await db
    .select({ count: count() })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        sql`${workspaceNeuralObservations.clusterId} IS NOT NULL`
      )
    );

  // Pinecone vector counts by view
  const namespace = buildNamespace(clerkOrgId, workspaceId);
  const pineconeStats = await countPineconeVectors(indexName, namespace);

  const totalObs = obsCount?.count ?? 0;

  return {
    database: {
      observations: totalObs,
      entities: entityCount?.count ?? 0,
      clusters: clusterCount?.count ?? 0,
      actorProfiles: profileCount?.count ?? 0,
      observationsByType: Object.fromEntries(obsByType.map(r => [r.type, r.count])),
      entitiesByCategory: Object.fromEntries(entsByCategory.map(r => [r.category, r.count])),
    },
    pinecone: pineconeStats,
    health: {
      multiViewComplete: (obsWithAllEmbeddings?.count ?? 0) === totalObs && totalObs > 0,
      entitiesExtracted: (entityCount?.count ?? 0) > 0,
      clustersAssigned: (obsWithClusters?.count ?? 0) > 0,
    },
  };
};

const buildNamespace = (clerkOrgId: string, workspaceId: string): string => {
  const sanitize = (s: string) => s.toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 50);
  return `${sanitize(clerkOrgId)}:ws_${sanitize(workspaceId)}`;
};

const countPineconeVectors = async (
  indexName: string,
  namespace: string
): Promise<{ titleVectors: number; contentVectors: number; summaryVectors: number }> => {
  try {
    // Query with dummy vector to count by view
    const dummyVector = Array.from({ length: 1024 }, () => 0.1);

    const [titleResult, contentResult, summaryResult] = await Promise.all([
      consolePineconeClient.query(indexName, {
        vector: dummyVector,
        topK: 10000,
        filter: { layer: { $eq: "observations" }, view: { $eq: "title" } },
        includeMetadata: false,
      }, namespace),
      consolePineconeClient.query(indexName, {
        vector: dummyVector,
        topK: 10000,
        filter: { layer: { $eq: "observations" }, view: { $eq: "content" } },
        includeMetadata: false,
      }, namespace),
      consolePineconeClient.query(indexName, {
        vector: dummyVector,
        topK: 10000,
        filter: { layer: { $eq: "observations" }, view: { $eq: "summary" } },
        includeMetadata: false,
      }, namespace),
    ]);

    return {
      titleVectors: titleResult.matches?.length ?? 0,
      contentVectors: contentResult.matches?.length ?? 0,
      summaryVectors: summaryResult.matches?.length ?? 0,
    };
  } catch {
    return { titleVectors: 0, contentVectors: 0, summaryVectors: 0 };
  }
};

/**
 * Print formatted verification report
 */
export const printReport = (result: WorkflowVerificationResult): void => {
  console.log("\n========================================");
  console.log("   TEST DATA VERIFICATION REPORT");
  console.log("========================================\n");

  console.log("DATABASE:");
  console.log(`  Observations: ${result.database.observations}`);
  console.log(`  Entities: ${result.database.entities}`);
  console.log(`  Clusters: ${result.database.clusters}`);
  console.log(`  Actor Profiles: ${result.database.actorProfiles}`);

  console.log("\n  By Observation Type:");
  for (const [type, cnt] of Object.entries(result.database.observationsByType)) {
    console.log(`    ${type}: ${cnt}`);
  }

  console.log("\n  By Entity Category:");
  for (const [cat, cnt] of Object.entries(result.database.entitiesByCategory)) {
    console.log(`    ${cat}: ${cnt}`);
  }

  console.log("\nPINECONE:");
  console.log(`  Title vectors: ${result.pinecone.titleVectors}`);
  console.log(`  Content vectors: ${result.pinecone.contentVectors}`);
  console.log(`  Summary vectors: ${result.pinecone.summaryVectors}`);

  console.log("\nHEALTH CHECKS:");
  console.log(`  Multi-view complete: ${result.health.multiViewComplete ? "PASS" : "FAIL"}`);
  console.log(`  Entities extracted: ${result.health.entitiesExtracted ? "PASS" : "FAIL"}`);
  console.log(`  Clusters assigned: ${result.health.clustersAssigned ? "PASS" : "FAIL"}`);

  console.log("\n========================================\n");
};

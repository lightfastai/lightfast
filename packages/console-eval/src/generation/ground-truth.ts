import { db } from "@db/console/client";
import { workspaceNeuralObservations } from "@db/console/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface GroundTruthMapping {
  sourceId: string;         // Template ID from corpus
  externalId: string;       // Observation ID in database
  title: string;
  sourceType: string;
}

/**
 * Query database to map sourceIds -> externalIds
 * Assumes test data has been injected via Inngest
 */
export async function resolveGroundTruth(
  workspaceId: string,
  sourceIds: string[]
): Promise<GroundTruthMapping[]> {
  const observations = await db
    .select({
      sourceId: workspaceNeuralObservations.sourceId,
      externalId: workspaceNeuralObservations.externalId,
      title: workspaceNeuralObservations.title,
      sourceType: workspaceNeuralObservations.sourceType,
    })
    .from(workspaceNeuralObservations)
    .where(
      and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        inArray(workspaceNeuralObservations.sourceId, sourceIds)
      )
    );

  return observations;
}

/**
 * Annotate generated queries with resolved externalIds
 */
export async function annotateWithGroundTruth(
  queries: Array<{ query: string; expectedEventIds: string[] }>,
  workspaceId: string
): Promise<Array<{
  query: string;
  expectedObservationIds: string[];
  missingIds: string[];
}>> {
  const allSourceIds = Array.from(
    new Set(queries.flatMap(q => q.expectedEventIds))
  );

  const groundTruth = await resolveGroundTruth(workspaceId, allSourceIds);
  const sourceIdToExternalId = new Map(
    groundTruth.map(gt => [gt.sourceId, gt.externalId])
  );

  return queries.map(q => {
    const resolved: string[] = [];
    const missing: string[] = [];

    for (const sourceId of q.expectedEventIds) {
      const externalId = sourceIdToExternalId.get(sourceId);
      if (externalId) {
        resolved.push(externalId);
      } else {
        missing.push(sourceId);
      }
    }

    return {
      query: q.query,
      expectedObservationIds: resolved,
      missingIds: missing,
    };
  });
}

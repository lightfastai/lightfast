/**
 * ID Resolver - Resolves observation IDs from various formats
 *
 * Handles both database nanoid IDs and Pinecone vector IDs, providing
 * backward compatibility for the v1/contents and v1/findsimilar endpoints.
 */

import { db } from "@db/console/client";
import { workspaceNeuralObservations } from "@db/console/schema";
import { and, eq, or, inArray } from "drizzle-orm";

/**
 * Observation data returned by the resolver
 */
export interface ResolvedObservation {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceId: string;
  observationType: string;
  occurredAt: string;
  clusterId: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Detect if an ID is a Pinecone vector ID (vs database nanoid)
 */
export function isVectorId(id: string): boolean {
  return (
    id.startsWith("obs_title_") ||
    id.startsWith("obs_content_") ||
    id.startsWith("obs_summary_") ||
    id.startsWith("obs_") // Legacy combined embedding
  );
}

/**
 * Get the view type from a vector ID
 */
export function getVectorIdView(
  id: string
): "title" | "content" | "summary" | "legacy" | null {
  if (id.startsWith("obs_title_")) return "title";
  if (id.startsWith("obs_content_")) return "content";
  if (id.startsWith("obs_summary_")) return "summary";
  if (id.startsWith("obs_")) return "legacy";
  return null;
}

/**
 * Resolve a single observation by any ID format.
 * First tries database ID lookup, then falls back to vector ID columns.
 */
export async function resolveObservationById(
  workspaceId: string,
  id: string,
  _columns: {
    id?: true;
    title?: true;
    content?: true;
    source?: true;
    sourceId?: true;
    observationType?: true;
    occurredAt?: true;
    clusterId?: true;
    metadata?: true;
  }
): Promise<ResolvedObservation | null> {
  // Try database ID first (most common case after Phase 2)
  const byDbId = await db.query.workspaceNeuralObservations.findFirst({
    columns: {
      id: true,
      title: true,
      content: true,
      source: true,
      sourceId: true,
      observationType: true,
      occurredAt: true,
      clusterId: true,
      metadata: true,
    },
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      eq(workspaceNeuralObservations.id, id)
    ),
  });

  if (byDbId) {
    return {
      id: byDbId.id,
      title: byDbId.title,
      content: byDbId.content,
      source: byDbId.source,
      sourceId: byDbId.sourceId,
      observationType: byDbId.observationType,
      occurredAt: byDbId.occurredAt,
      clusterId: byDbId.clusterId,
      metadata: byDbId.metadata as Record<string, unknown> | null,
    };
  }

  // Fallback: Try vector ID columns if it looks like a vector ID
  if (!isVectorId(id)) return null;

  const byVectorId = await db.query.workspaceNeuralObservations.findFirst({
    columns: {
      id: true,
      title: true,
      content: true,
      source: true,
      sourceId: true,
      observationType: true,
      occurredAt: true,
      clusterId: true,
      metadata: true,
    },
    where: and(
      eq(workspaceNeuralObservations.workspaceId, workspaceId),
      or(
        eq(workspaceNeuralObservations.embeddingTitleId, id),
        eq(workspaceNeuralObservations.embeddingContentId, id),
        eq(workspaceNeuralObservations.embeddingSummaryId, id),
        eq(workspaceNeuralObservations.embeddingVectorId, id) // Legacy
      )
    ),
  });

  if (byVectorId) {
    return {
      id: byVectorId.id,
      title: byVectorId.title,
      content: byVectorId.content,
      source: byVectorId.source,
      sourceId: byVectorId.sourceId,
      observationType: byVectorId.observationType,
      occurredAt: byVectorId.occurredAt,
      clusterId: byVectorId.clusterId,
      metadata: byVectorId.metadata as Record<string, unknown> | null,
    };
  }

  return null;
}

/**
 * Resolve multiple observations by any ID format.
 * Groups IDs by type for efficient batch queries.
 * Returns a Map where keys are the original request IDs (which may be vector IDs)
 * and values are the resolved observation data.
 */
export async function resolveObservationsById(
  workspaceId: string,
  ids: string[],
  _columns: {
    id?: true;
    title?: true;
    content?: true;
    source?: true;
    sourceId?: true;
    observationType?: true;
    occurredAt?: true;
    clusterId?: true;
    metadata?: true;
  }
): Promise<Map<string, ResolvedObservation>> {
  const result = new Map<string, ResolvedObservation>();
  if (ids.length === 0) return result;

  // Separate database IDs from vector IDs
  const dbIds = ids.filter((id) => !isVectorId(id));
  const vectorIds = ids.filter(isVectorId);

  // Batch query for database IDs
  if (dbIds.length > 0) {
    const byDbIds = await db.query.workspaceNeuralObservations.findMany({
      columns: {
        id: true,
        title: true,
        content: true,
        source: true,
        sourceId: true,
        observationType: true,
        occurredAt: true,
        clusterId: true,
        metadata: true,
      },
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        inArray(workspaceNeuralObservations.id, dbIds)
      ),
    });

    for (const obs of byDbIds) {
      result.set(obs.id, {
        id: obs.id,
        title: obs.title,
        content: obs.content,
        source: obs.source,
        sourceId: obs.sourceId,
        observationType: obs.observationType,
        occurredAt: obs.occurredAt,
        clusterId: obs.clusterId,
        metadata: obs.metadata as Record<string, unknown> | null,
      });
    }
  }

  // For vector IDs, we need to query differently since we don't know which column
  // The OR query approach may be slow without indexes, but indexes are added in this phase
  if (vectorIds.length > 0) {
    const byVectorIds = await db
      .select({
        id: workspaceNeuralObservations.id,
        embeddingTitleId: workspaceNeuralObservations.embeddingTitleId,
        embeddingContentId: workspaceNeuralObservations.embeddingContentId,
        embeddingSummaryId: workspaceNeuralObservations.embeddingSummaryId,
        embeddingVectorId: workspaceNeuralObservations.embeddingVectorId,
        title: workspaceNeuralObservations.title,
        content: workspaceNeuralObservations.content,
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
          or(
            inArray(workspaceNeuralObservations.embeddingTitleId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingContentId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingSummaryId, vectorIds),
            inArray(workspaceNeuralObservations.embeddingVectorId, vectorIds)
          )
        )
      );

    // Map each observation to ALL matching vector IDs from the request
    for (const obs of byVectorIds) {
      const matchingIds = vectorIds.filter(
        (vid) =>
          vid === obs.embeddingTitleId ||
          vid === obs.embeddingContentId ||
          vid === obs.embeddingSummaryId ||
          vid === obs.embeddingVectorId
      );

      const resolved: ResolvedObservation = {
        id: obs.id,
        title: obs.title,
        content: obs.content,
        source: obs.source,
        sourceId: obs.sourceId,
        observationType: obs.observationType,
        occurredAt: obs.occurredAt,
        clusterId: obs.clusterId,
        metadata: obs.metadata as Record<string, unknown> | null,
      };

      for (const vid of matchingIds) {
        result.set(vid, resolved);
      }
    }
  }

  return result;
}

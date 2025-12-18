/**
 * ID Resolver - Resolves observation IDs from various formats
 *
 * Handles externalId (nanoid), internal BIGINT ids, and Pinecone vector IDs,
 * providing backward compatibility for the v1/contents and v1/findsimilar endpoints.
 *
 * After BIGINT migration:
 * - Internal id: BIGINT auto-increment (for DB joins/performance)
 * - externalId: nanoid (for API/Pinecone lookups)
 * - Vector IDs: obs_title_*, obs_content_*, obs_summary_* (legacy support)
 */

import { db } from "@db/console/client";
import { workspaceNeuralObservations } from "@db/console/schema";
import { and, eq, or, inArray } from "drizzle-orm";

/**
 * Observation data returned by the resolver
 */
export interface ResolvedObservation {
  id: number;           // Internal BIGINT
  externalId: string;   // Public nanoid for API responses
  title: string;
  content: string;
  source: string;
  sourceId: string;
  observationType: string;
  occurredAt: string;
  clusterId: number | null;
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
 * Tries externalId first (nanoid for API lookups), then falls back to vector ID columns.
 */
export async function resolveObservationById(
  workspaceId: string,
  id: string,
  _columns: {
    id?: true;
    externalId?: true;
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
  // Try externalId first (most common case - API callers use nanoid)
  const byExternalId = await db.query.workspaceNeuralObservations.findFirst({
    columns: {
      id: true,
      externalId: true,
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
      eq(workspaceNeuralObservations.externalId, id)
    ),
  });

  if (byExternalId) {
    return {
      id: byExternalId.id,
      externalId: byExternalId.externalId,
      title: byExternalId.title,
      content: byExternalId.content,
      source: byExternalId.source,
      sourceId: byExternalId.sourceId,
      observationType: byExternalId.observationType,
      occurredAt: byExternalId.occurredAt,
      clusterId: byExternalId.clusterId,
      metadata: byExternalId.metadata as Record<string, unknown> | null,
    };
  }

  // Fallback: Try vector ID columns if it looks like a vector ID
  if (!isVectorId(id)) return null;

  const byVectorId = await db.query.workspaceNeuralObservations.findFirst({
    columns: {
      id: true,
      externalId: true,
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
      externalId: byVectorId.externalId,
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
 * Returns a Map where keys are the original request IDs (which may be externalIds or vector IDs)
 * and values are the resolved observation data.
 */
export async function resolveObservationsById(
  workspaceId: string,
  ids: string[],
  _columns: {
    id?: true;
    externalId?: true;
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

  // Separate externalIds (nanoids) from vector IDs
  const externalIds = ids.filter((id) => !isVectorId(id));
  const vectorIds = ids.filter(isVectorId);

  // Batch query for externalIds (nanoids)
  if (externalIds.length > 0) {
    const byExternalIds = await db.query.workspaceNeuralObservations.findMany({
      columns: {
        id: true,
        externalId: true,
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
        inArray(workspaceNeuralObservations.externalId, externalIds)
      ),
    });

    for (const obs of byExternalIds) {
      result.set(obs.externalId, {
        id: obs.id,
        externalId: obs.externalId,
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
        externalId: workspaceNeuralObservations.externalId,
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
        externalId: obs.externalId,
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

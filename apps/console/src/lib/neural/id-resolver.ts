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
import { workspaceEvents, workspaceInterpretations } from "@db/console/schema";
import { and, eq, inArray, or } from "drizzle-orm";

/**
 * Observation data returned by the resolver
 */
export interface ResolvedObservation {
  content: string;
  externalId: string; // Public nanoid for API responses
  id: number; // Internal BIGINT
  metadata: Record<string, unknown> | null;
  observationType: string;
  occurredAt: string;
  source: string;
  sourceId: string;
  title: string;
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
  if (id.startsWith("obs_title_")) {
    return "title";
  }
  if (id.startsWith("obs_content_")) {
    return "content";
  }
  if (id.startsWith("obs_summary_")) {
    return "summary";
  }
  if (id.startsWith("obs_")) {
    return "legacy";
  }
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
    metadata?: true;
  }
): Promise<ResolvedObservation | null> {
  // Try externalId first (most common case - API callers use nanoid)
  const byExternalId = await db.query.workspaceEvents.findFirst({
    columns: {
      id: true,
      externalId: true,
      title: true,
      content: true,
      source: true,
      sourceId: true,
      observationType: true,
      occurredAt: true,
      metadata: true,
    },
    where: and(
      eq(workspaceEvents.workspaceId, workspaceId),
      eq(workspaceEvents.externalId, id)
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
      metadata: byExternalId.metadata as Record<string, unknown> | null,
    };
  }

  // Fallback: Try interpretation table if it looks like a vector ID
  if (!isVectorId(id)) {
    return null;
  }

  const interp = await db.query.workspaceInterpretations.findFirst({
    columns: { eventId: true },
    where: and(
      eq(workspaceInterpretations.workspaceId, workspaceId),
      or(
        eq(workspaceInterpretations.embeddingTitleId, id),
        eq(workspaceInterpretations.embeddingContentId, id),
        eq(workspaceInterpretations.embeddingSummaryId, id)
      )
    ),
  });

  if (!interp) {
    return null;
  }

  const byVectorId = await db.query.workspaceEvents.findFirst({
    columns: {
      id: true,
      externalId: true,
      title: true,
      content: true,
      source: true,
      sourceId: true,
      observationType: true,
      occurredAt: true,
      metadata: true,
    },
    where: eq(workspaceEvents.id, interp.eventId),
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
    metadata?: true;
  }
): Promise<Map<string, ResolvedObservation>> {
  const result = new Map<string, ResolvedObservation>();
  if (ids.length === 0) {
    return result;
  }

  // Separate externalIds (nanoids) from vector IDs
  const externalIds = ids.filter((id) => !isVectorId(id));
  const vectorIds = ids.filter(isVectorId);

  // Batch query for externalIds (nanoids)
  if (externalIds.length > 0) {
    const byExternalIds = await db.query.workspaceEvents.findMany({
      columns: {
        id: true,
        externalId: true,
        title: true,
        content: true,
        source: true,
        sourceId: true,
        observationType: true,
        occurredAt: true,
        metadata: true,
      },
      where: and(
        eq(workspaceEvents.workspaceId, workspaceId),
        inArray(workspaceEvents.externalId, externalIds)
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
        metadata: obs.metadata as Record<string, unknown> | null,
      });
    }
  }

  // For vector IDs, query the interpretation table then fetch observations
  if (vectorIds.length > 0) {
    const interpretations = await db
      .select({
        eventId: workspaceInterpretations.eventId,
        embeddingTitleId: workspaceInterpretations.embeddingTitleId,
        embeddingContentId: workspaceInterpretations.embeddingContentId,
        embeddingSummaryId: workspaceInterpretations.embeddingSummaryId,
      })
      .from(workspaceInterpretations)
      .where(
        and(
          eq(workspaceInterpretations.workspaceId, workspaceId),
          or(
            inArray(workspaceInterpretations.embeddingTitleId, vectorIds),
            inArray(workspaceInterpretations.embeddingContentId, vectorIds),
            inArray(workspaceInterpretations.embeddingSummaryId, vectorIds)
          )
        )
      );

    const obsInternalIds = [...new Set(interpretations.map((i) => i.eventId))];
    const obsRows =
      obsInternalIds.length > 0
        ? await db
            .select({
              id: workspaceEvents.id,
              externalId: workspaceEvents.externalId,
              title: workspaceEvents.title,
              content: workspaceEvents.content,
              source: workspaceEvents.source,
              sourceId: workspaceEvents.sourceId,
              observationType: workspaceEvents.observationType,
              occurredAt: workspaceEvents.occurredAt,
              metadata: workspaceEvents.metadata,
            })
            .from(workspaceEvents)
            .where(inArray(workspaceEvents.id, obsInternalIds))
        : [];

    const obsById = new Map(obsRows.map((o) => [o.id, o]));

    // Map each vector ID to its resolved observation
    for (const interp of interpretations) {
      const obs = obsById.get(interp.eventId);
      if (!obs) {
        continue;
      }

      const resolved: ResolvedObservation = {
        id: obs.id,
        externalId: obs.externalId,
        title: obs.title,
        content: obs.content,
        source: obs.source,
        sourceId: obs.sourceId,
        observationType: obs.observationType,
        occurredAt: obs.occurredAt,
        metadata: obs.metadata as Record<string, unknown> | null,
      };

      const matchingIds = vectorIds.filter(
        (vid) =>
          vid === interp.embeddingTitleId ||
          vid === interp.embeddingContentId ||
          vid === interp.embeddingSummaryId
      );
      for (const vid of matchingIds) {
        result.set(vid, resolved);
      }
    }
  }

  return result;
}

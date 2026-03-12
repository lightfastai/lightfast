import { db } from "@db/console/client";
import {
  workspaceEdges,
  workspaceEntityEvents,
  workspaceEvents,
} from "@db/console/schema";
import { log } from "@vendor/observability/log";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import type { V1AuthContext } from "./types";

export interface RelatedLogicInput {
  observationId: string;
  requestId: string;
}

interface RelatedItem {
  direction: "outgoing" | "incoming";
  id: string;
  occurredAt: string | null;
  relationshipType: string;
  source: string;
  title: string;
  type: string;
  url: string | null;
}

export interface RelatedLogicOutput {
  data: {
    source: {
      id: string;
      title: string;
      source: string;
    };
    related: RelatedItem[];
    bySource: Record<string, RelatedItem[]>;
  };
  meta: {
    total: number;
    took: number;
  };
  requestId: string;
}

export async function relatedLogic(
  auth: V1AuthContext,
  input: RelatedLogicInput
): Promise<RelatedLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/related logic executing", {
    requestId: input.requestId,
    observationId: input.observationId,
  });

  // Step 1: Get the source observation
  const sourceObs = await db.query.workspaceEvents.findFirst({
    where: and(
      eq(workspaceEvents.workspaceId, auth.workspaceId),
      eq(workspaceEvents.externalId, input.observationId)
    ),
    columns: {
      id: true,
      externalId: true,
      title: true,
      source: true,
    },
  });

  if (!sourceObs) {
    throw new Error(`Observation not found: ${input.observationId}`);
  }

  // Step 2: Get source observation's entity IDs
  const sourceJunctions = await db
    .select({ entityId: workspaceEntityEvents.entityId })
    .from(workspaceEntityEvents)
    .where(eq(workspaceEntityEvents.eventId, sourceObs.id));
  const sourceEntityIds = sourceJunctions.map((j) => j.entityId);

  if (sourceEntityIds.length === 0) {
    return {
      data: {
        source: {
          id: sourceObs.externalId,
          title: sourceObs.title,
          source: sourceObs.source,
        },
        related: [],
        bySource: {},
      },
      meta: { total: 0, took: Date.now() - startTime },
      requestId: input.requestId,
    };
  }

  // Step 3: Find direct entity edges
  const edges = await db
    .select()
    .from(workspaceEdges)
    .where(
      and(
        eq(workspaceEdges.workspaceId, auth.workspaceId),
        or(
          inArray(workspaceEdges.sourceEntityId, sourceEntityIds),
          inArray(workspaceEdges.targetEntityId, sourceEntityIds)
        )
      )
    );

  if (edges.length === 0) {
    return {
      data: {
        source: {
          id: sourceObs.externalId,
          title: sourceObs.title,
          source: sourceObs.source,
        },
        related: [],
        bySource: {},
      },
      meta: { total: 0, took: Date.now() - startTime },
      requestId: input.requestId,
    };
  }

  // Step 4: Collect neighbor entity IDs and their directions
  const sourceEntitySet = new Set(sourceEntityIds);
  const neighborEntityInfo = new Map<
    number,
    { relationshipType: string; direction: "outgoing" | "incoming" }
  >();

  for (const edge of edges) {
    const isSource = sourceEntitySet.has(edge.sourceEntityId);
    const isTarget = sourceEntitySet.has(edge.targetEntityId);

    if (isSource && !isTarget) {
      neighborEntityInfo.set(edge.targetEntityId, {
        relationshipType: edge.relationshipType,
        direction: "outgoing",
      });
    } else if (isTarget && !isSource) {
      neighborEntityInfo.set(edge.sourceEntityId, {
        relationshipType: edge.relationshipType,
        direction: "incoming",
      });
    }
  }

  const neighborEntityIds = [...neighborEntityInfo.keys()];
  if (neighborEntityIds.length === 0) {
    return {
      data: {
        source: {
          id: sourceObs.externalId,
          title: sourceObs.title,
          source: sourceObs.source,
        },
        related: [],
        bySource: {},
      },
      meta: { total: 0, took: Date.now() - startTime },
      requestId: input.requestId,
    };
  }

  // Step 5: Find events for neighbor entities via junction table
  const neighborJunctions = await db
    .select({
      entityId: workspaceEntityEvents.entityId,
      observationId: workspaceEntityEvents.eventId,
    })
    .from(workspaceEntityEvents)
    .where(inArray(workspaceEntityEvents.entityId, neighborEntityIds));

  // Map: observationId → { relationshipType, direction }
  const relatedObsInfo = new Map<
    number,
    { relationshipType: string; direction: "outgoing" | "incoming" }
  >();
  for (const j of neighborJunctions) {
    if (j.observationId === sourceObs.id) {
      continue; // Skip self
    }
    const info = neighborEntityInfo.get(j.entityId);
    if (info && !relatedObsInfo.has(j.observationId)) {
      relatedObsInfo.set(j.observationId, info);
    }
  }

  // Step 6: Fetch related observation details
  const relatedObsIds = [...relatedObsInfo.keys()];
  const relatedObs =
    relatedObsIds.length > 0
      ? await db
          .select({
            id: workspaceEvents.id,
            externalId: workspaceEvents.externalId,
            title: workspaceEvents.title,
            source: workspaceEvents.source,
            observationType: workspaceEvents.observationType,
            occurredAt: workspaceEvents.occurredAt,
            metadata: workspaceEvents.metadata,
          })
          .from(workspaceEvents)
          .where(
            and(
              eq(workspaceEvents.workspaceId, auth.workspaceId),
              inArray(workspaceEvents.id, relatedObsIds)
            )
          )
          .orderBy(desc(workspaceEvents.occurredAt))
      : [];

  // Step 7: Format response
  const related: RelatedItem[] = relatedObs.map((obs) => {
    const relInfo = relatedObsInfo.get(obs.id);
    const metadata = obs.metadata as Record<string, unknown> | undefined;
    const metadataUrl = metadata?.url;
    return {
      id: obs.externalId,
      title: obs.title,
      source: obs.source,
      type: obs.observationType,
      occurredAt: obs.occurredAt,
      url: typeof metadataUrl === "string" ? metadataUrl : null,
      relationshipType: relInfo?.relationshipType ?? "references",
      direction: relInfo?.direction ?? "outgoing",
    };
  });

  // Group by source
  const bySource: Record<string, RelatedItem[]> = {
    github: related.filter((r) => r.source === "github"),
    vercel: related.filter((r) => r.source === "vercel"),
    sentry: related.filter((r) => r.source === "sentry"),
    linear: related.filter((r) => r.source === "linear"),
  };

  // Remove empty arrays
  for (const key of Object.keys(bySource)) {
    if (bySource[key]?.length === 0) {
      delete bySource[key];
    }
  }

  log.debug("v1/related logic complete", {
    requestId: input.requestId,
    total: related.length,
  });

  return {
    data: {
      source: {
        id: sourceObs.externalId,
        title: sourceObs.title,
        source: sourceObs.source,
      },
      related,
      bySource,
    },
    meta: {
      total: related.length,
      took: Date.now() - startTime,
    },
    requestId: input.requestId,
  };
}

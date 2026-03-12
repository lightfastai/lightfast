import { db } from "@db/console/client";
import {
  workspaceEdges,
  workspaceEntityEvents,
  workspaceEvents,
} from "@db/console/schema";
import { log } from "@vendor/observability/log";
import { and, eq, inArray, or } from "drizzle-orm";
import type { V1AuthContext } from "./types";

export interface GraphLogicInput {
  allowedTypes?: string[] | null;
  depth: number;
  observationId: string;
  requestId: string;
}

export interface GraphLogicOutput {
  data: {
    root: {
      id: string;
      title: string;
      source: string;
      type: string;
    };
    nodes: {
      id: string;
      title: string;
      source: string;
      type: string;
      occurredAt: string | null;
      url: string | null;
      isRoot: boolean;
    }[];
    edges: {
      source: string;
      target: string;
      type: string;
      linkingKey: string | null;
      confidence: number;
    }[];
  };
  meta: {
    depth: number;
    nodeCount: number;
    edgeCount: number;
    took: number;
  };
  requestId: string;
}

export async function graphLogic(
  auth: V1AuthContext,
  input: GraphLogicInput
): Promise<GraphLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/graph logic executing", {
    requestId: input.requestId,
    observationId: input.observationId,
  });

  // Step 1: Get the root observation
  const rootObs = await db.query.workspaceEvents.findFirst({
    where: and(
      eq(workspaceEvents.workspaceId, auth.workspaceId),
      eq(workspaceEvents.externalId, input.observationId)
    ),
    columns: {
      id: true,
      externalId: true,
      title: true,
      source: true,
      observationType: true,
      occurredAt: true,
      metadata: true,
    },
  });

  if (!rootObs) {
    throw new Error(`Observation not found: ${input.observationId}`);
  }

  // Step 2: Get root observation's entity IDs
  const rootJunctions = await db
    .select({ entityId: workspaceEntityEvents.entityId })
    .from(workspaceEntityEvents)
    .where(eq(workspaceEntityEvents.eventId, rootObs.id));
  const rootEntityIds = rootJunctions.map((j) => j.entityId);

  // Map: entityId → list of event IDs that reference it
  const entityToEventsMap = new Map<number, number[]>();
  for (const entityId of rootEntityIds) {
    entityToEventsMap.set(entityId, [rootObs.id]);
  }

  // Step 3: BFS over entity↔entity edges
  let entityFrontier = rootEntityIds;
  const visitedEntityIds = new Set(rootEntityIds);
  const collectedEdges: (typeof workspaceEdges.$inferSelect)[] = [];
  const allEventIds = new Set([rootObs.id]);

  const depth = Math.min(input.depth, 3);
  const allowedTypes = input.allowedTypes;

  for (let d = 0; d < depth && entityFrontier.length > 0; d++) {
    const edges = await db
      .select()
      .from(workspaceEdges)
      .where(
        and(
          eq(workspaceEdges.workspaceId, auth.workspaceId),
          or(
            inArray(workspaceEdges.sourceEntityId, entityFrontier),
            inArray(workspaceEdges.targetEntityId, entityFrontier)
          )
        )
      );

    const filteredEdges = allowedTypes
      ? edges.filter((e) => allowedTypes.includes(e.relationshipType))
      : edges;

    collectedEdges.push(...filteredEdges);

    // Collect new entity IDs from this BFS level
    const newEntityIds = new Set<number>();
    for (const edge of filteredEdges) {
      if (!visitedEntityIds.has(edge.sourceEntityId)) {
        newEntityIds.add(edge.sourceEntityId);
      }
      if (!visitedEntityIds.has(edge.targetEntityId)) {
        newEntityIds.add(edge.targetEntityId);
      }
    }

    entityFrontier = [...newEntityIds];
    for (const id of newEntityIds) {
      visitedEntityIds.add(id);
    }

    // Resolve new entities back to events via junction table
    if (newEntityIds.size > 0) {
      const junctions = await db
        .select({
          entityId: workspaceEntityEvents.entityId,
          observationId: workspaceEntityEvents.eventId,
        })
        .from(workspaceEntityEvents)
        .where(inArray(workspaceEntityEvents.entityId, [...newEntityIds]));

      for (const j of junctions) {
        allEventIds.add(j.observationId);
        const existing = entityToEventsMap.get(j.entityId) ?? [];
        existing.push(j.observationId);
        entityToEventsMap.set(j.entityId, existing);
      }
    }
  }

  // Step 4: Fetch all event details
  const events =
    allEventIds.size > 0
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
          .where(inArray(workspaceEvents.id, [...allEventIds]))
      : [];

  const eventMap = new Map(events.map((e) => [e.id, e]));

  // Step 5: Map entity↔entity edges to event-level edges for API response
  const edgeSet = new Set<string>();
  const responseEdges: GraphLogicOutput["data"]["edges"] = [];

  for (const edge of collectedEdges) {
    // Use the first event associated with each entity as the representative
    const sourceEventId = entityToEventsMap.get(edge.sourceEntityId)?.[0];
    const targetEventId = entityToEventsMap.get(edge.targetEntityId)?.[0];
    if (!(sourceEventId && targetEventId)) {
      continue;
    }

    const sourceEvent = eventMap.get(sourceEventId);
    const targetEvent = eventMap.get(targetEventId);
    if (!(sourceEvent && targetEvent) || sourceEvent.id === targetEvent.id) {
      continue;
    }

    const edgeKey = `${sourceEvent.externalId}-${targetEvent.externalId}-${edge.relationshipType}`;
    if (!edgeSet.has(edgeKey)) {
      edgeSet.add(edgeKey);
      responseEdges.push({
        source: sourceEvent.externalId,
        target: targetEvent.externalId,
        type: edge.relationshipType,
        linkingKey: null,
        confidence: edge.confidence,
      });
    }
  }

  // Step 6: Format response
  const nodes = events.map((obs) => {
    const metadata = obs.metadata as Record<string, unknown> | undefined;
    const metadataUrl = metadata?.url;
    return {
      id: obs.externalId,
      title: obs.title,
      source: obs.source,
      type: obs.observationType,
      occurredAt: obs.occurredAt,
      url: typeof metadataUrl === "string" ? metadataUrl : null,
      isRoot: obs.id === rootObs.id,
    };
  });

  log.debug("v1/graph logic complete", {
    requestId: input.requestId,
    nodeCount: nodes.length,
    edgeCount: responseEdges.length,
  });

  return {
    data: {
      root: {
        id: rootObs.externalId,
        title: rootObs.title,
        source: rootObs.source,
        type: rootObs.observationType,
      },
      nodes,
      edges: responseEdges,
    },
    meta: {
      depth,
      nodeCount: nodes.length,
      edgeCount: responseEdges.length,
      took: Date.now() - startTime,
    },
    requestId: input.requestId,
  };
}

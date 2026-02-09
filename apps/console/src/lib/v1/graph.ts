import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import { and, eq, or, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import type { V1AuthContext } from "./types";

export interface GraphLogicInput {
  observationId: string;
  depth: number;
  allowedTypes?: string[] | null;
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
  input: GraphLogicInput,
): Promise<GraphLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/graph logic executing", { requestId: input.requestId, observationId: input.observationId });

  // Step 1: Get the root observation
  const rootObs = await db.query.workspaceNeuralObservations.findFirst({
    where: and(
      eq(workspaceNeuralObservations.workspaceId, auth.workspaceId),
      eq(workspaceNeuralObservations.externalId, input.observationId)
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

  // Step 2: BFS traversal to find connected observations
  const visited = new Set<number>([rootObs.id]);
  const edges: GraphLogicOutput["data"]["edges"] = [];
  const nodeMap = new Map<number, typeof rootObs>();
  nodeMap.set(rootObs.id, rootObs);

  let frontier = [rootObs.id];
  const depth = Math.min(input.depth, 3);

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    // Find all relationships involving frontier nodes
    const relationships = await db
      .select()
      .from(workspaceObservationRelationships)
      .where(
        and(
          eq(workspaceObservationRelationships.workspaceId, auth.workspaceId),
          or(
            inArray(workspaceObservationRelationships.sourceObservationId, frontier),
            inArray(workspaceObservationRelationships.targetObservationId, frontier)
          )
        )
      );

    // Filter by allowed types if specified
    const filteredRels = input.allowedTypes
      ? // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        relationships.filter((r) => input.allowedTypes!.includes(r.relationshipType))
      : relationships;

    // Collect new node IDs
    const newNodeIds = new Set<number>();
    for (const rel of filteredRels) {
      if (!visited.has(rel.sourceObservationId)) {
        newNodeIds.add(rel.sourceObservationId);
      }
      if (!visited.has(rel.targetObservationId)) {
        newNodeIds.add(rel.targetObservationId);
      }
    }

    // Fetch new nodes
    if (newNodeIds.size > 0) {
      const newNodes = await db
        .select({
          id: workspaceNeuralObservations.id,
          externalId: workspaceNeuralObservations.externalId,
          title: workspaceNeuralObservations.title,
          source: workspaceNeuralObservations.source,
          observationType: workspaceNeuralObservations.observationType,
          occurredAt: workspaceNeuralObservations.occurredAt,
          metadata: workspaceNeuralObservations.metadata,
        })
        .from(workspaceNeuralObservations)
        .where(inArray(workspaceNeuralObservations.id, Array.from(newNodeIds)));

      for (const node of newNodes) {
        nodeMap.set(node.id, node);
        visited.add(node.id);
      }
    }

    // Record edges
    for (const rel of filteredRels) {
      const sourceNode = nodeMap.get(rel.sourceObservationId);
      const targetNode = nodeMap.get(rel.targetObservationId);
      if (sourceNode && targetNode) {
        edges.push({
          source: sourceNode.externalId,
          target: targetNode.externalId,
          type: rel.relationshipType,
          linkingKey: rel.linkingKey,
          confidence: rel.confidence,
        });
      }
    }

    // Update frontier
    frontier = Array.from(newNodeIds);
  }

  // Step 3: Format response
  const nodes = Array.from(nodeMap.values()).map((node) => {
    const metadata = node.metadata as Record<string, unknown> | undefined;
    const metadataUrl = metadata?.url;
    return {
      id: node.externalId,
      title: node.title,
      source: node.source,
      type: node.observationType,
      occurredAt: node.occurredAt,
      url: typeof metadataUrl === "string" ? metadataUrl : null,
      isRoot: node.id === rootObs.id,
    };
  });

  log.debug("v1/graph logic complete", {
    requestId: input.requestId,
    nodeCount: nodes.length,
    edgeCount: edges.length,
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
      edges,
    },
    meta: {
      depth,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      took: Date.now() - startTime,
    },
    requestId: input.requestId,
  };
}

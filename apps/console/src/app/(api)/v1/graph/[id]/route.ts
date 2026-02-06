/**
 * Graph API
 *
 * GET /v1/graph/{observationId}?depth=2&types=fixes,deploys
 *
 * Traverses the relationship graph from a starting observation.
 * Returns connected observations with relationship edges.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import { and, eq, or, inArray } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import {
  withDualAuth,
  createDualAuthErrorResponse,
} from "../../lib/with-dual-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = randomUUID();
  const startTime = Date.now();
  const { id: observationId } = await params;

  log.info("v1/graph request", { requestId, observationId });

  try {
    // Parse query params
    const { searchParams } = new URL(request.url);
    const depth = Math.min(parseInt(searchParams.get("depth") ?? "2", 10), 3);
    const typesParam = searchParams.get("types");
    const allowedTypes = typesParam ? typesParam.split(",") : null;

    // Authenticate
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId } = authResult.auth;

    // Step 1: Get the root observation
    const rootObs = await db.query.workspaceNeuralObservations.findFirst({
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.externalId, observationId)
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
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Observation not found", requestId },
        { status: 404 }
      );
    }

    // Step 2: BFS traversal to find connected observations
    const visited = new Set<number>([rootObs.id]);
    const edges: {
      source: string;
      target: string;
      type: string;
      linkingKey: string | null;
      confidence: number;
    }[] = [];
    const nodeMap = new Map<number, typeof rootObs>();
    nodeMap.set(rootObs.id, rootObs);

    let frontier = [rootObs.id];

    for (let d = 0; d < depth && frontier.length > 0; d++) {
      // Find all relationships involving frontier nodes
      const relationships = await db
        .select()
        .from(workspaceObservationRelationships)
        .where(
          and(
            eq(workspaceObservationRelationships.workspaceId, workspaceId),
            or(
              inArray(workspaceObservationRelationships.sourceObservationId, frontier),
              inArray(workspaceObservationRelationships.targetObservationId, frontier)
            )
          )
        );

      // Filter by allowed types if specified
      const filteredRels = allowedTypes
        ? relationships.filter((r) => allowedTypes.includes(r.relationshipType))
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

    log.info("v1/graph complete", {
      requestId,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      depth,
      took: Date.now() - startTime,
    });

    return NextResponse.json({
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
      requestId,
    });
  } catch (error) {
    log.error("v1/graph error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Graph traversal failed",
        requestId,
      },
      { status: 500 }
    );
  }
}

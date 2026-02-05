/**
 * Related Events API
 *
 * GET /v1/related/{observationId}
 *
 * Returns observations directly connected to the given observation
 * via the relationship graph. Simpler than full graph traversal.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import { and, eq, or, inArray, desc } from "drizzle-orm";
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

  log.info("v1/related request", { requestId, observationId });

  try {
    // Authenticate
    const authResult = await withDualAuth(request, requestId);
    if (!authResult.success) {
      return createDualAuthErrorResponse(authResult, requestId);
    }

    const { workspaceId } = authResult.auth;

    // Step 1: Get the source observation
    const sourceObs = await db.query.workspaceNeuralObservations.findFirst({
      where: and(
        eq(workspaceNeuralObservations.workspaceId, workspaceId),
        eq(workspaceNeuralObservations.externalId, observationId)
      ),
      columns: {
        id: true,
        externalId: true,
        title: true,
        source: true,
      },
    });

    if (!sourceObs) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Observation not found", requestId },
        { status: 404 }
      );
    }

    // Step 2: Find direct relationships (both directions)
    const relationships = await db
      .select()
      .from(workspaceObservationRelationships)
      .where(
        and(
          eq(workspaceObservationRelationships.workspaceId, workspaceId),
          or(
            eq(workspaceObservationRelationships.sourceObservationId, sourceObs.id),
            eq(workspaceObservationRelationships.targetObservationId, sourceObs.id)
          )
        )
      );

    // Step 3: Collect related observation IDs
    const relatedIds = new Set<number>();
    const relMap = new Map<number, { type: string; direction: "outgoing" | "incoming" }>();

    for (const rel of relationships) {
      if (rel.sourceObservationId === sourceObs.id) {
        relatedIds.add(rel.targetObservationId);
        relMap.set(rel.targetObservationId, {
          type: rel.relationshipType,
          direction: "outgoing",
        });
      } else {
        relatedIds.add(rel.sourceObservationId);
        relMap.set(rel.sourceObservationId, {
          type: rel.relationshipType,
          direction: "incoming",
        });
      }
    }

    // Step 4: Fetch related observations
    const relatedObs = relatedIds.size > 0
      ? await db
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
          .where(
            and(
              eq(workspaceNeuralObservations.workspaceId, workspaceId),
              inArray(workspaceNeuralObservations.id, Array.from(relatedIds))
            )
          )
          .orderBy(desc(workspaceNeuralObservations.occurredAt))
      : [];

    // Step 5: Format response
    const related = relatedObs.map((obs) => {
      const relInfo = relMap.get(obs.id);
      const metadata = obs.metadata as Record<string, unknown> | undefined;
      const metadataUrl = metadata?.url;
      return {
        id: obs.externalId,
        title: obs.title,
        source: obs.source,
        type: obs.observationType,
        occurredAt: obs.occurredAt,
        url: typeof metadataUrl === "string" ? metadataUrl : null,
        relationshipType: relInfo?.type ?? "references",
        direction: relInfo?.direction ?? "outgoing",
      };
    });

    // Group by source
    const bySource: Record<string, typeof related> = {
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

    log.info("v1/related complete", {
      requestId,
      total: related.length,
      took: Date.now() - startTime,
    });

    return NextResponse.json({
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
      requestId,
    });
  } catch (error) {
    log.error("v1/related error", {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Related lookup failed",
        requestId,
      },
      { status: 500 }
    );
  }
}

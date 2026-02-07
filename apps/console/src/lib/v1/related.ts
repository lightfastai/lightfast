import { db } from "@db/console/client";
import {
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import { and, eq, or, inArray, desc } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { NotFoundError } from "@repo/console-types";
import type { V1AuthContext } from "./index";

export interface RelatedLogicInput {
  observationId: string;
  requestId: string;
}

interface RelatedItem {
  id: string;
  title: string;
  source: string;
  type: string;
  occurredAt: string | null;
  url: string | null;
  relationshipType: string;
  direction: "outgoing" | "incoming";
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
  input: RelatedLogicInput,
): Promise<RelatedLogicOutput> {
  const startTime = Date.now();

  log.debug("v1/related logic executing", { requestId: input.requestId, observationId: input.observationId });

  // Step 1: Get the source observation
  const sourceObs = await db.query.workspaceNeuralObservations.findFirst({
    where: and(
      eq(workspaceNeuralObservations.workspaceId, auth.workspaceId),
      eq(workspaceNeuralObservations.externalId, input.observationId)
    ),
    columns: {
      id: true,
      externalId: true,
      title: true,
      source: true,
    },
  });

  if (!sourceObs) {
    log.warn("Related query - observation not found", {
      observationId: input.observationId,
      workspaceId: auth.workspaceId,
      requestId: input.requestId,
    });
    throw new NotFoundError("Observation", input.observationId);
  }

  // Step 2: Find direct relationships
  const relationships = await db
    .select()
    .from(workspaceObservationRelationships)
    .where(
      and(
        eq(workspaceObservationRelationships.workspaceId, auth.workspaceId),
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
            eq(workspaceNeuralObservations.workspaceId, auth.workspaceId),
            inArray(workspaceNeuralObservations.id, Array.from(relatedIds))
          )
        )
        .orderBy(desc(workspaceNeuralObservations.occurredAt))
    : [];

  // Step 5: Format response
  const related: RelatedItem[] = relatedObs.map((obs) => {
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

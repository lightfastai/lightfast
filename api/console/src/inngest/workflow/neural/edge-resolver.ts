import { db } from "@db/console/client";
import type { RelationshipType } from "@db/console/schema";
import {
  workspaceEntityObservations,
  workspaceNeuralEntities,
  workspaceNeuralObservations,
  workspaceObservationRelationships,
} from "@db/console/schema";
import type { EdgeRule } from "@repo/console-providers";
import { PROVIDERS } from "@repo/console-providers";
import type { DetectedRelationship } from "@repo/console-validation";
import { log } from "@vendor/observability/log";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * Resolve edges for a new observation using entity-mediated bidirectional matching.
 *
 * Algorithm:
 * 1. Query junction table for all observations sharing any of this observation's entities
 * 2. For each co-occurring observation, load both providers' edge rules
 * 3. Evaluate rules bidirectionally (most specific wins)
 * 4. Insert detected edges
 *
 * Handles out-of-order events: when the second event arrives, it finds the first
 * through the shared entity in the junction table.
 */
export async function resolveEdges(
  workspaceId: string,
  observationId: number,
  source: string,
  entityRefs: Array<{ type: string; key: string; label: string | null }>
): Promise<number> {
  if (entityRefs.length === 0) {
    return 0;
  }

  // 1. Find entity IDs for this observation's structural refs
  const structuralTypes = ["commit", "branch", "pr", "issue", "deployment"];
  const structuralRefs = entityRefs.filter((r) =>
    structuralTypes.includes(r.type)
  );
  if (structuralRefs.length === 0) {
    return 0;
  }

  // Query entity IDs by (workspace, category, key)
  const entityConditions = structuralRefs.map(
    (ref) =>
      sql`(${workspaceNeuralEntities.category} = ${ref.type} AND ${workspaceNeuralEntities.key} = ${ref.key})`
  );

  const entities = await db
    .select({
      id: workspaceNeuralEntities.id,
      category: workspaceNeuralEntities.category,
      key: workspaceNeuralEntities.key,
    })
    .from(workspaceNeuralEntities)
    .where(
      and(
        eq(workspaceNeuralEntities.workspaceId, workspaceId),
        sql`(${sql.join(entityConditions, sql` OR `)})`
      )
    );

  if (entities.length === 0) {
    return 0;
  }

  const entityIds = entities.map((e) => e.id);

  // 2. Find co-occurring observations through junction table
  const coOccurring = await db
    .select({
      observationId: workspaceEntityObservations.observationId,
      entityId: workspaceEntityObservations.entityId,
    })
    .from(workspaceEntityObservations)
    .where(
      and(
        inArray(workspaceEntityObservations.entityId, entityIds),
        ne(workspaceEntityObservations.observationId, observationId)
      )
    )
    .limit(100);

  if (coOccurring.length === 0) {
    return 0;
  }

  // 3. Load co-occurring observation sources
  const coObsIds = [...new Set(coOccurring.map((c) => c.observationId))];
  const coObservations = await db
    .select({
      id: workspaceNeuralObservations.id,
      source: workspaceNeuralObservations.source,
    })
    .from(workspaceNeuralObservations)
    .where(inArray(workspaceNeuralObservations.id, coObsIds));

  const coObsSourceMap = new Map(coObservations.map((o) => [o.id, o.source]));
  const entityMap = new Map(entities.map((e) => [e.id, e]));

  // 4. Evaluate edge rules bidirectionally
  const myRules = getEdgeRules(source);
  const detected: DetectedRelationship[] = [];

  for (const coOcc of coOccurring) {
    const otherSource = coObsSourceMap.get(coOcc.observationId);
    if (!otherSource) {
      continue;
    }

    const entity = entityMap.get(coOcc.entityId);
    if (!entity) {
      continue;
    }

    // Find matching ref from this observation
    const matchingRef = entityRefs.find(
      (r) => r.type === entity.category && r.key === entity.key
    );

    const otherRules = getEdgeRules(otherSource);

    // Try my rules first (most specific wins)
    const rule =
      findBestRule(
        myRules,
        entity.category,
        matchingRef?.label ?? null,
        otherSource,
        entity.category
      ) ??
      findBestRule(otherRules, entity.category, null, source, entity.category);

    if (rule) {
      detected.push({
        targetObservationId: coOcc.observationId,
        relationshipType: rule.relationshipType,
        linkingKey: entity.key,
        linkingKeyType: entity.category,
        confidence: rule.confidence,
        metadata: { detectionMethod: "entity_cooccurrence" as const },
      });
    } else {
      // Fallback: co_occurs at low confidence
      detected.push({
        targetObservationId: coOcc.observationId,
        relationshipType: "co_occurs",
        linkingKey: entity.key,
        linkingKeyType: entity.category,
        confidence: 0.5,
        metadata: { detectionMethod: "entity_cooccurrence" as const },
      });
    }
  }

  // 5. Deduplicate and insert
  const deduped = deduplicateEdges(detected);
  if (deduped.length === 0) {
    return 0;
  }

  const inserts = deduped.map((rel) => ({
    externalId: nanoid(),
    workspaceId,
    sourceObservationId: observationId,
    targetObservationId: rel.targetObservationId,
    relationshipType: rel.relationshipType as RelationshipType,
    linkingKey: rel.linkingKey,
    linkingKeyType: rel.linkingKeyType,
    confidence: rel.confidence,
    metadata: rel.metadata,
  }));

  try {
    await db
      .insert(workspaceObservationRelationships)
      .values(inserts)
      .onConflictDoNothing();
    log.info("Entity-mediated edges created", {
      observationId,
      count: inserts.length,
    });
    return inserts.length;
  } catch (error) {
    log.error("Failed to create edges", { error, workspaceId });
    return 0;
  }
}

function getEdgeRules(source: string): EdgeRule[] {
  const provider = Object.values(PROVIDERS).find((p) => p.name === source);
  return provider?.edgeRules ?? [];
}

function findBestRule(
  rules: EdgeRule[],
  refType: string,
  selfLabel: string | null,
  matchProvider: string,
  matchRefType: string
): EdgeRule | null {
  // Most specific first: selfLabel match > provider-specific > wildcard
  const candidates = rules.filter(
    (r) => r.refType === refType && r.matchRefType === matchRefType
  );

  // 1. selfLabel + specific provider
  const labelSpecific = candidates.find(
    (r) =>
      r.selfLabel === selfLabel &&
      selfLabel !== null &&
      r.matchProvider === matchProvider
  );
  if (labelSpecific) {
    return labelSpecific;
  }

  // 2. selfLabel + wildcard provider
  const labelWild = candidates.find(
    (r) =>
      r.selfLabel === selfLabel && selfLabel !== null && r.matchProvider === "*"
  );
  if (labelWild) {
    return labelWild;
  }

  // 3. No selfLabel + specific provider
  const noLabelSpecific = candidates.find(
    (r) => !r.selfLabel && r.matchProvider === matchProvider
  );
  if (noLabelSpecific) {
    return noLabelSpecific;
  }

  // 4. No selfLabel + wildcard
  const noLabelWild = candidates.find(
    (r) => !r.selfLabel && r.matchProvider === "*"
  );
  return noLabelWild ?? null;
}

function deduplicateEdges(
  relationships: DetectedRelationship[]
): DetectedRelationship[] {
  const byTarget = new Map<string, DetectedRelationship>();
  for (const rel of relationships) {
    const key = `${rel.targetObservationId}-${rel.relationshipType}`;
    const existing = byTarget.get(key);
    if (!existing || rel.confidence > existing.confidence) {
      byTarget.set(key, rel);
    }
  }
  return Array.from(byTarget.values());
}

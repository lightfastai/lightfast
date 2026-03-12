import { db } from "@db/console/client";
import {
  workspaceEdges,
  workspaceEntities,
  workspaceEntityEvents,
  workspaceEvents,
} from "@db/console/schema";
import type { EdgeRule } from "@repo/console-providers";
import { PROVIDERS } from "@repo/console-providers";
import { log } from "@vendor/observability/log";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

const STRUCTURAL_TYPES = ["commit", "branch", "pr", "issue", "deployment"];

/**
 * Resolve entity↔entity edges for a newly processed event.
 *
 * Algorithm:
 * 1. Find entities for our event's structural refs
 * 2. Find co-occurring events via shared entities in junction table
 * 3. For each co-occurring event, load ALL its entity refs
 * 4. Enumerate cross-entity-type pairs, evaluate rules
 * 5. Insert entity↔entity edges
 */
export async function resolveEdges(
  workspaceId: string,
  eventId: number,
  source: string,
  entityRefs: Array<{ type: string; key: string; label: string | null }>
): Promise<number> {
  // 1. Filter to structural refs only
  const structuralRefs = entityRefs.filter((r) =>
    STRUCTURAL_TYPES.includes(r.type)
  );
  if (structuralRefs.length === 0) {
    return 0;
  }

  // 2. Find entity IDs for our refs
  const entityConditions = structuralRefs.map(
    (ref) =>
      sql`(${workspaceEntities.category} = ${ref.type} AND ${workspaceEntities.key} = ${ref.key})`
  );

  const ourEntities = await db
    .select({
      id: workspaceEntities.id,
      category: workspaceEntities.category,
      key: workspaceEntities.key,
    })
    .from(workspaceEntities)
    .where(
      and(
        eq(workspaceEntities.workspaceId, workspaceId),
        sql`(${sql.join(entityConditions, sql` OR `)})`
      )
    );

  if (ourEntities.length === 0) {
    return 0;
  }

  const ourEntityIds = ourEntities.map((e) => e.id);

  // Build ref label map: (category, key) → label
  const refLabelMap = new Map(
    structuralRefs
      .filter((r) => r.label)
      .map((r) => [`${r.type}:${r.key}`, r.label])
  );

  // 3. Find co-occurring events via junction table
  const coOccurring = await db
    .select({
      eventId: workspaceEntityEvents.eventId,
      entityId: workspaceEntityEvents.entityId,
    })
    .from(workspaceEntityEvents)
    .where(
      and(
        inArray(workspaceEntityEvents.entityId, ourEntityIds),
        ne(workspaceEntityEvents.eventId, eventId)
      )
    )
    .limit(100);

  if (coOccurring.length === 0) {
    return 0;
  }

  // 4. Get unique co-occurring event IDs and their sources
  const coEventIds = [...new Set(coOccurring.map((c) => c.eventId))];

  const [coEvents, coEventEntityJunctions] = await Promise.all([
    db
      .select({ id: workspaceEvents.id, source: workspaceEvents.source })
      .from(workspaceEvents)
      .where(inArray(workspaceEvents.id, coEventIds)),
    db
      .select({
        eventId: workspaceEntityEvents.eventId,
        entityId: workspaceEntityEvents.entityId,
        refLabel: workspaceEntityEvents.refLabel,
      })
      .from(workspaceEntityEvents)
      .where(inArray(workspaceEntityEvents.eventId, coEventIds)),
  ]);

  const coEventSourceMap = new Map(coEvents.map((e) => [e.id, e.source]));

  // 5. Load ALL entity refs for co-occurring events

  // Load entity details for co-occurring events' entities
  const coEntityIds = [
    ...new Set(coEventEntityJunctions.map((j) => j.entityId)),
  ];
  const allCoEntities = await db
    .select({
      id: workspaceEntities.id,
      category: workspaceEntities.category,
      key: workspaceEntities.key,
    })
    .from(workspaceEntities)
    .where(inArray(workspaceEntities.id, coEntityIds));

  const coEntityMap = new Map(allCoEntities.map((e) => [e.id, e]));

  // Group co-event junctions by event ID
  const coEventEntitiesMap = new Map<
    number,
    Array<{
      entityId: number;
      category: string;
      key: string;
      refLabel: string | null;
    }>
  >();
  for (const j of coEventEntityJunctions) {
    const entity = coEntityMap.get(j.entityId);
    if (!entity) {
      continue;
    }
    const arr = coEventEntitiesMap.get(j.eventId) ?? [];
    arr.push({
      entityId: j.entityId,
      category: entity.category,
      key: entity.key,
      refLabel: j.refLabel,
    });
    coEventEntitiesMap.set(j.eventId, arr);
  }

  // 6. Evaluate cross-entity-type rules
  const rulesCache = new Map<string, EdgeRule[]>();
  function getCachedEdgeRules(src: string): EdgeRule[] {
    let rules = rulesCache.get(src);
    if (!rules) {
      const provider = Object.values(PROVIDERS).find((p) => p.name === src);
      rules = provider?.edgeRules ?? [];
      rulesCache.set(src, rules);
    }
    return rules;
  }

  const myRules = getCachedEdgeRules(source);
  const candidates: EdgeCandidate[] = [];

  for (const coEventId of coEventIds) {
    const otherSource = coEventSourceMap.get(coEventId);
    if (!otherSource) {
      continue;
    }

    const otherEntities = coEventEntitiesMap.get(coEventId) ?? [];
    const otherRules = getCachedEdgeRules(otherSource);

    // Enumerate all pairs: (our entity, their entity)
    for (const ourEntity of ourEntities) {
      const ourLabel =
        refLabelMap.get(`${ourEntity.category}:${ourEntity.key}`) ?? null;

      for (const theirEntity of otherEntities) {
        // Skip self-edges (same entity)
        if (ourEntity.id === theirEntity.entityId) {
          continue;
        }

        // Try our rules first, then their rules
        const rule =
          findBestRule(
            myRules,
            ourEntity.category,
            ourLabel,
            otherSource,
            theirEntity.category
          ) ??
          findBestRule(
            otherRules,
            theirEntity.category,
            theirEntity.refLabel,
            source,
            ourEntity.category
          );

        if (rule) {
          candidates.push({
            sourceEntityId: ourEntity.id,
            targetEntityId: theirEntity.entityId,
            relationshipType: rule.relationshipType,
            confidence: rule.confidence,
          });
        }
      }
    }
  }

  // 7. Deduplicate: keep highest confidence per (source, target, type)
  const deduped = deduplicateEdgeCandidates(candidates);
  if (deduped.length === 0) {
    return 0;
  }

  // 8. Insert entity↔entity edges
  const inserts = deduped.map((edge) => ({
    externalId: nanoid(),
    workspaceId,
    sourceEntityId: edge.sourceEntityId,
    targetEntityId: edge.targetEntityId,
    relationshipType: edge.relationshipType,
    sourceEventId: eventId,
    confidence: edge.confidence,
    metadata: { detectionMethod: "entity_cooccurrence" },
  }));

  try {
    await db.insert(workspaceEdges).values(inserts).onConflictDoNothing();
    log.info("Entity edges created", {
      eventId,
      count: inserts.length,
    });
    return inserts.length;
  } catch (error) {
    log.error("Failed to create entity edges", { error, workspaceId });
    return 0;
  }
}

function findBestRule(
  rules: EdgeRule[],
  refType: string,
  selfLabel: string | null,
  matchProvider: string,
  matchRefType: string
): EdgeRule | null {
  const candidates = rules.filter(
    (r) => r.refType === refType && r.matchRefType === matchRefType
  );

  // 1. selfLabel + specific provider
  if (selfLabel) {
    const labelSpecific = candidates.find(
      (r) => r.selfLabel === selfLabel && r.matchProvider === matchProvider
    );
    if (labelSpecific) {
      return labelSpecific;
    }

    // 2. selfLabel + wildcard provider
    const labelWild = candidates.find(
      (r) => r.selfLabel === selfLabel && r.matchProvider === "*"
    );
    if (labelWild) {
      return labelWild;
    }
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

function deduplicateEdgeCandidates(
  candidates: EdgeCandidate[]
): EdgeCandidate[] {
  const byKey = new Map<string, EdgeCandidate>();
  for (const c of candidates) {
    const key = `${c.sourceEntityId}-${c.targetEntityId}-${c.relationshipType}`;
    const existing = byKey.get(key);
    if (!existing || c.confidence > existing.confidence) {
      byKey.set(key, c);
    }
  }
  return Array.from(byKey.values());
}

interface EdgeCandidate {
  confidence: number;
  relationshipType: string;
  sourceEntityId: number;
  targetEntityId: number;
}

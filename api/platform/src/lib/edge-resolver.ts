import { db } from "@db/app/client";
import {
  orgEntities,
  orgEntityEdges,
  orgEventEntities,
  orgEvents,
} from "@db/app/schema";
import type { EdgeRule } from "@repo/app-providers";
import { PROVIDERS } from "@repo/app-providers";
import { log } from "@vendor/observability/log/next";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

const STRUCTURAL_TYPES = ["commit", "branch", "pr", "issue", "deployment"];

/**
 * Resolve entity<->entity edges for a newly processed event.
 *
 * Algorithm:
 * 1. Find entities for our event's structural refs
 * 2. Find co-occurring events via shared entities in junction table
 * 3. For each co-occurring event, load ALL its entity refs
 * 4. Enumerate cross-entity-type pairs, evaluate rules
 * 5. Insert entity<->entity edges
 */
export async function resolveEdges(
  clerkOrgId: string,
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
      sql`(${orgEntities.category} = ${ref.type} AND ${orgEntities.key} = ${ref.key})`
  );

  const ourEntities = await db
    .select({
      id: orgEntities.id,
      category: orgEntities.category,
      key: orgEntities.key,
    })
    .from(orgEntities)
    .where(
      and(
        eq(orgEntities.clerkOrgId, clerkOrgId),
        sql`(${sql.join(entityConditions, sql` OR `)})`
      )
    );

  if (ourEntities.length === 0) {
    return 0;
  }

  const ourEntityIds = ourEntities.map((e) => e.id);

  // Build ref label map: (category, key) -> label
  const refLabelMap = new Map(
    structuralRefs
      .filter((r) => r.label)
      .map((r) => [`${r.type}:${r.key}`, r.label])
  );

  // 3. Find co-occurring events via junction table
  const coOccurring = await db
    .select({
      eventId: orgEventEntities.eventId,
      entityId: orgEventEntities.entityId,
    })
    .from(orgEventEntities)
    .where(
      and(
        inArray(orgEventEntities.entityId, ourEntityIds),
        ne(orgEventEntities.eventId, eventId)
      )
    )
    .orderBy(desc(orgEventEntities.eventId))
    .limit(100);

  if (coOccurring.length === 0) {
    return 0;
  }

  if (coOccurring.length === 100) {
    log.warn(
      "[edge-resolver] co-occurrence limit reached, recent events preferred",
      {
        eventId,
        clerkOrgId,
        entityCount: ourEntityIds.length,
      }
    );
  }

  // 4. Get unique co-occurring event IDs and their sources
  const coEventIds = [...new Set(coOccurring.map((c) => c.eventId))];

  const [coEvents, coEventEntityJunctions] = await Promise.all([
    db
      .select({ id: orgEvents.id, source: orgEvents.source })
      .from(orgEvents)
      .where(inArray(orgEvents.id, coEventIds)),
    db
      .select({
        eventId: orgEventEntities.eventId,
        entityId: orgEventEntities.entityId,
        refLabel: orgEventEntities.refLabel,
        category: orgEventEntities.category,
      })
      .from(orgEventEntities)
      .where(inArray(orgEventEntities.eventId, coEventIds)),
  ]);

  const coEventSourceMap = new Map(coEvents.map((e) => [e.id, e.source]));

  // 5. Build co-event entity map directly from junction rows (category is now denormalized)
  const coEventEntitiesMap = new Map<
    number,
    Array<{
      entityId: number;
      category: string;
      refLabel: string | null;
    }>
  >();
  for (const j of coEventEntityJunctions) {
    if (!j.category) {
      // Pre-migration rows without category — skip (cannot evaluate rules)
      continue;
    }
    let arr = coEventEntitiesMap.get(j.eventId);
    if (!arr) {
      arr = [];
      coEventEntitiesMap.set(j.eventId, arr);
    }
    arr.push({
      entityId: j.entityId,
      category: j.category,
      refLabel: j.refLabel,
    });
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

        // Try our rules first
        const myMatch = findBestRule(
          myRules,
          ourEntity.category,
          ourLabel,
          otherSource,
          theirEntity.category
        );

        if (myMatch) {
          // Our rule — our entity is the source
          candidates.push({
            sourceEntityId: ourEntity.id,
            targetEntityId: theirEntity.entityId,
            relationshipType: myMatch.relationshipType,
            confidence: myMatch.confidence,
          });
        } else {
          // Fallback: try their rules (from their perspective)
          const otherMatch = findBestRule(
            otherRules,
            theirEntity.category,
            theirEntity.refLabel,
            source,
            ourEntity.category
          );

          if (otherMatch) {
            // Their rule — their entity is the source, ours is the target
            candidates.push({
              sourceEntityId: theirEntity.entityId,
              targetEntityId: ourEntity.id,
              relationshipType: otherMatch.relationshipType,
              confidence: otherMatch.confidence,
            });
          }
        }
      }
    }
  }

  // 7. Deduplicate: keep highest confidence per (source, target, type)
  const deduped = deduplicateEdgeCandidates(candidates);
  if (deduped.length === 0) {
    return 0;
  }

  // 8. Insert entity<->entity edges
  const inserts = deduped.map((edge) => ({
    externalId: nanoid(),
    clerkOrgId,
    sourceEntityId: edge.sourceEntityId,
    targetEntityId: edge.targetEntityId,
    relationshipType: edge.relationshipType,
    sourceEventId: eventId,
    confidence: edge.confidence,
    metadata: { detectionMethod: "entity_cooccurrence" },
  }));

  try {
    await db
      .insert(orgEntityEdges)
      .values(inserts)
      .onConflictDoUpdate({
        target: [
          orgEntityEdges.clerkOrgId,
          orgEntityEdges.sourceEntityId,
          orgEntityEdges.targetEntityId,
          orgEntityEdges.relationshipType,
        ],
        set: {
          confidence: sql`GREATEST(EXCLUDED.confidence, ${orgEntityEdges.confidence})`,
          lastSeenAt: sql`CURRENT_TIMESTAMP`,
          sourceEventId: sql`EXCLUDED.source_event_id`,
        },
      });
    log.info("[edge-resolver] entity edges created", {
      eventId,
      count: inserts.length,
    });
    return inserts.length;
  } catch (error) {
    log.error("[edge-resolver] failed to create entity edges", {
      error,
      clerkOrgId,
    });
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
    // Canonical key: order entity IDs so (A,B) and (B,A) map to the same key.
    // Store in canonical direction too so cross-call inserts always conflict
    // rather than inserting both (A,B) and (B,A) as separate DB rows.
    const lo = Math.min(c.sourceEntityId, c.targetEntityId);
    const hi = Math.max(c.sourceEntityId, c.targetEntityId);
    const key = `${lo}-${hi}-${c.relationshipType}`;
    const existing = byKey.get(key);
    if (!existing || c.confidence > existing.confidence) {
      byKey.set(key, { ...c, sourceEntityId: lo, targetEntityId: hi });
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

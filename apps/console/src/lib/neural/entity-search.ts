import { db } from "@db/console/client";
import {
  workspaceEntities,
  workspaceEntityEvents,
  workspaceEvents,
} from "@db/console/schema";
import type {
  EntityCategory,
  EntitySearchResult,
} from "@repo/console-validation";
import { and, desc, eq, inArray } from "drizzle-orm";

/**
 * Patterns to extract entity references from search queries
 */
const QUERY_ENTITY_PATTERNS: {
  category: EntityCategory;
  pattern: RegExp;
  keyExtractor: (match: RegExpMatchArray) => string;
}[] = [
  // @mentions
  {
    category: "engineer",
    pattern: /@([a-zA-Z0-9_-]{1,39})\b/g,
    keyExtractor: (m) => `@${m[1]}`,
  },
  // Issue/PR references
  {
    category: "project",
    pattern: /(#\d{1,6})/g,
    keyExtractor: (m) => m[1] ?? "",
  },
  // Linear/Jira style
  {
    category: "project",
    pattern: /\b([A-Z]{2,10}-\d{1,6})\b/g,
    keyExtractor: (m) => m[1] ?? "",
  },
  // API endpoints
  {
    category: "endpoint",
    pattern: /\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s"'<>]{1,100})/gi,
    keyExtractor: (m) => `${m[1]?.toUpperCase()} ${m[2]}`,
  },
];

/**
 * Extract entity references from a search query
 */
export function extractQueryEntities(
  query: string
): { category: EntityCategory; key: string }[] {
  const entities: { category: EntityCategory; key: string }[] = [];

  for (const { category, pattern, keyExtractor } of QUERY_ENTITY_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(query)) !== null) {
      const key = keyExtractor(match);
      if (key && key.length >= 2) {
        entities.push({ category, key });
      }
    }
  }

  return entities;
}

/**
 * Search for observations linked to entities mentioned in the query
 *
 * @param query - User's search query
 * @param workspaceId - Workspace to search in
 * @param limit - Max results to return
 * @returns Observations linked to matched entities
 */
export async function searchByEntities(
  query: string,
  workspaceId: string,
  limit = 10
): Promise<EntitySearchResult[]> {
  // 1. Extract entity references from query
  const queryEntities = extractQueryEntities(query);

  if (queryEntities.length === 0) {
    return [];
  }

  // 2. Find matching entities (exact key match)
  const entityKeys = queryEntities.map((e) => e.key);
  const matchedEntities = await db
    .select({
      id: workspaceEntities.id,
      key: workspaceEntities.key,
      category: workspaceEntities.category,
      occurrenceCount: workspaceEntities.occurrenceCount,
      confidence: workspaceEntities.confidence,
    })
    .from(workspaceEntities)
    .where(
      and(
        eq(workspaceEntities.workspaceId, workspaceId),
        inArray(workspaceEntities.key, entityKeys)
      )
    )
    .orderBy(desc(workspaceEntities.occurrenceCount))
    .limit(limit);

  if (matchedEntities.length === 0) {
    return [];
  }

  // 3. Query junction table for all observations for these entities
  const entityIds = matchedEntities.map((e) => e.id);
  const junctions = await db
    .select({
      entityId: workspaceEntityEvents.entityId,
      eventId: workspaceEntityEvents.eventId,
    })
    .from(workspaceEntityEvents)
    .where(inArray(workspaceEntityEvents.entityId, entityIds))
    .limit(limit * 3);

  if (junctions.length === 0) {
    return [];
  }

  // 4. Fetch unique observations
  const observationIds = [...new Set(junctions.map((j) => j.eventId))];
  const observations = await db
    .select({
      id: workspaceEvents.id,
      externalId: workspaceEvents.externalId,
      title: workspaceEvents.title,
      content: workspaceEvents.content,
    })
    .from(workspaceEvents)
    .where(inArray(workspaceEvents.id, observationIds));

  // 5. Build result maps
  const obsMap = new Map(observations.map((o) => [o.id, o]));
  const entityMap = new Map(matchedEntities.map((e) => [e.id, e]));

  const results: EntitySearchResult[] = [];
  for (const junction of junctions) {
    const entity = entityMap.get(junction.entityId);
    const obs = obsMap.get(junction.eventId);
    if (!(entity && obs)) {
      continue;
    }

    results.push({
      entityId: String(entity.id),
      entityKey: entity.key,
      entityCategory: entity.category,
      observationId: obs.externalId,
      observationTitle: obs.title,
      observationSnippet: obs.content.substring(0, 200),
      occurrenceCount: entity.occurrenceCount,
      confidence: entity.confidence ?? 0.8,
    });
  }

  return results.slice(0, limit);
}

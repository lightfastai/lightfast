import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "@db/console/client";
import { workspaceNeuralEntities, workspaceNeuralObservations } from "@db/console/schema";
import type { EntityCategory } from "@repo/console-validation";
import type { EntitySearchResult } from "@repo/console-types";

/**
 * Patterns to extract entity references from search queries
 */
const QUERY_ENTITY_PATTERNS: Array<{
  category: EntityCategory;
  pattern: RegExp;
  keyExtractor: (match: RegExpMatchArray) => string;
}> = [
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
    keyExtractor: (m) => m[1] || "",
  },
  // Linear/Jira style
  {
    category: "project",
    pattern: /\b([A-Z]{2,10}-\d{1,6})\b/g,
    keyExtractor: (m) => m[1] || "",
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
): Array<{ category: EntityCategory; key: string }> {
  const entities: Array<{ category: EntityCategory; key: string }> = [];

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
  limit: number = 10
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
      id: workspaceNeuralEntities.id,
      key: workspaceNeuralEntities.key,
      category: workspaceNeuralEntities.category,
      sourceObservationId: workspaceNeuralEntities.sourceObservationId,
      occurrenceCount: workspaceNeuralEntities.occurrenceCount,
      confidence: workspaceNeuralEntities.confidence,
    })
    .from(workspaceNeuralEntities)
    .where(
      and(
        eq(workspaceNeuralEntities.workspaceId, workspaceId),
        inArray(workspaceNeuralEntities.key, entityKeys)
      )
    )
    .orderBy(desc(workspaceNeuralEntities.occurrenceCount))
    .limit(limit);

  if (matchedEntities.length === 0) {
    return [];
  }

  // 3. Fetch linked observations
  const observationIds = matchedEntities
    .map((e) => e.sourceObservationId)
    .filter((id): id is string => id !== null);

  if (observationIds.length === 0) {
    return [];
  }

  const observations = await db
    .select({
      id: workspaceNeuralObservations.id,
      title: workspaceNeuralObservations.title,
      content: workspaceNeuralObservations.content,
    })
    .from(workspaceNeuralObservations)
    .where(inArray(workspaceNeuralObservations.id, observationIds));

  // 4. Build result map
  const obsMap = new Map(observations.map((o) => [o.id, o]));

  return matchedEntities
    .filter((e) => e.sourceObservationId && obsMap.has(e.sourceObservationId))
    .map((entity) => {
      const obs = obsMap.get(entity.sourceObservationId!)!;
      return {
        entityId: entity.id,
        entityKey: entity.key,
        entityCategory: entity.category as EntityCategory,
        observationId: obs.id,
        observationTitle: obs.title,
        observationSnippet: obs.content?.substring(0, 200) || "",
        occurrenceCount: entity.occurrenceCount,
        confidence: entity.confidence ?? 0.8,
      };
    });
}

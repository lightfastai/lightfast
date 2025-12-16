import { and, desc, eq, ilike, or, inArray } from "drizzle-orm";
import { db } from "@db/console/client";
import { workspaceActorProfiles, workspaceActorIdentities } from "@db/console/schema";

export interface ActorSearchResult {
  actorId: string;
  displayName: string;
  expertiseDomains: string[];
  observationCount: number;
  lastActiveAt: string | null;
  matchType: "mention" | "expertise" | "name";
  score: number;
}

/**
 * Extract actor mentions from query text
 * Patterns: @username, "John Doe", engineer names
 */
function extractActorMentions(query: string): string[] {
  const mentions: string[] = [];

  // @username pattern
  const atMentions = query.match(/@([a-zA-Z0-9_-]{1,39})\b/g);
  if (atMentions) {
    mentions.push(...atMentions.map((m) => m.slice(1).toLowerCase()));
  }

  // "Name" in quotes pattern (often used for person names)
  const quotedNames = query.match(/"([^"]+)"/g);
  if (quotedNames) {
    mentions.push(...quotedNames.map((m) => m.slice(1, -1).toLowerCase()));
  }

  return [...new Set(mentions)]; // Deduplicate
}

/**
 * Search for relevant actor profiles based on query
 * Matches by @mentions, display names, and expertise domains
 */
export async function searchActorProfiles(
  workspaceId: string,
  query: string,
  topK = 5
): Promise<{ results: ActorSearchResult[]; latency: number }> {
  const startTime = Date.now();

  try {
    const mentions = extractActorMentions(query);
    const queryLower = query.toLowerCase();

    // 1. Search by explicit @mentions
    let mentionMatches: ActorSearchResult[] = [];
    if (mentions.length > 0) {
      const identities = await db
        .select({
          canonicalActorId: workspaceActorIdentities.canonicalActorId,
          sourceUsername: workspaceActorIdentities.sourceUsername,
        })
        .from(workspaceActorIdentities)
        .where(
          and(
            eq(workspaceActorIdentities.workspaceId, workspaceId),
            or(
              ...mentions.map((m) =>
                ilike(workspaceActorIdentities.sourceUsername, `%${m}%`)
              )
            )
          )
        )
        .limit(topK);

      const actorIds = identities.map((i) => i.canonicalActorId);

      if (actorIds.length > 0) {
        const profiles = await db
          .select()
          .from(workspaceActorProfiles)
          .where(
            and(
              eq(workspaceActorProfiles.workspaceId, workspaceId),
              inArray(workspaceActorProfiles.actorId, actorIds)
            )
          );

        mentionMatches = profiles.map((p) => ({
          actorId: p.actorId,
          displayName: p.displayName,
          expertiseDomains: p.expertiseDomains ?? [],
          observationCount: p.observationCount,
          lastActiveAt: p.lastActiveAt,
          matchType: "mention" as const,
          score: 0.95, // High score for explicit mentions
        }));
      }
    }

    // 2. Search by display name (fuzzy match)
    const nameMatches = await db
      .select()
      .from(workspaceActorProfiles)
      .where(
        and(
          eq(workspaceActorProfiles.workspaceId, workspaceId),
          ilike(workspaceActorProfiles.displayName, `%${queryLower}%`)
        )
      )
      .orderBy(desc(workspaceActorProfiles.observationCount))
      .limit(topK);

    const nameResults: ActorSearchResult[] = nameMatches
      .filter((p) => !mentionMatches.some((m) => m.actorId === p.actorId))
      .map((p) => ({
        actorId: p.actorId,
        displayName: p.displayName,
        expertiseDomains: p.expertiseDomains ?? [],
        observationCount: p.observationCount,
        lastActiveAt: p.lastActiveAt,
        matchType: "name" as const,
        score: 0.75, // Medium score for name matches
      }));

    // 3. Combine and deduplicate results
    const allResults = [...mentionMatches, ...nameResults];

    // Sort by score then by observation count
    allResults.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.observationCount - a.observationCount;
    });

    return {
      results: allResults.slice(0, topK),
      latency: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Actor search failed:", error);
    return { results: [], latency: Date.now() - startTime };
  }
}

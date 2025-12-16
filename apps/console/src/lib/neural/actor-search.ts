import { and, desc, eq, ilike, or, inArray } from "drizzle-orm";
import { db } from "@db/console/client";
import {
  workspaceActorProfiles,
  orgActorIdentities,
  orgWorkspaces,
} from "@db/console/schema";

export interface ActorSearchResult {
  actorId: string;
  displayName: string;
  avatarUrl: string | null;
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
 * Search for relevant actor profiles based on query.
 *
 * Changed from workspace-level to org-level identity search:
 * - @mentions search org-level identities (all actors known to org)
 * - Profile data still filtered by workspace (activity is workspace-specific)
 * - Avatar URL now comes from identity table, not profile table
 */
export async function searchActorProfiles(
  workspaceId: string,
  query: string,
  topK = 5
): Promise<{ results: ActorSearchResult[]; latency: number }> {
  const startTime = Date.now();

  try {
    // Get clerkOrgId for this workspace
    const workspace = await db.query.orgWorkspaces.findFirst({
      where: eq(orgWorkspaces.id, workspaceId),
      columns: { clerkOrgId: true },
    });

    if (!workspace) {
      return { results: [], latency: Date.now() - startTime };
    }

    const mentions = extractActorMentions(query);
    const queryLower = query.toLowerCase();

    // 1. Search by explicit @mentions (ORG-LEVEL)
    let mentionMatches: ActorSearchResult[] = [];
    if (mentions.length > 0) {
      const identities = await db
        .select({
          canonicalActorId: orgActorIdentities.canonicalActorId,
          sourceUsername: orgActorIdentities.sourceUsername,
          avatarUrl: orgActorIdentities.avatarUrl,
        })
        .from(orgActorIdentities)
        .where(
          and(
            eq(orgActorIdentities.clerkOrgId, workspace.clerkOrgId),
            or(
              ...mentions.map((m) =>
                ilike(orgActorIdentities.sourceUsername, `%${m}%`)
              )
            )
          )
        )
        .limit(topK);

      const actorIds = identities.map((i) => i.canonicalActorId);

      if (actorIds.length > 0) {
        // Get profiles for these actors in this workspace
        const profiles = await db
          .select()
          .from(workspaceActorProfiles)
          .where(
            and(
              eq(workspaceActorProfiles.workspaceId, workspaceId),
              inArray(workspaceActorProfiles.actorId, actorIds)
            )
          );

        // Build map of actorId -> profile for quick lookup
        const profileMap = new Map(profiles.map((p) => [p.actorId, p]));

        // Combine identity data with profile data
        mentionMatches = identities
          .filter((i) => profileMap.has(i.canonicalActorId))
          .map((i) => {
            const profile = profileMap.get(i.canonicalActorId);
            if (!profile) return null;
            return {
              actorId: i.canonicalActorId,
              displayName: profile.displayName,
              avatarUrl: i.avatarUrl, // From identity, not profile
              expertiseDomains: [], // Not yet implemented in schema
              observationCount: profile.observationCount,
              lastActiveAt: profile.lastActiveAt,
              matchType: "mention" as const,
              score: 0.95, // High score for explicit mentions
            };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null);
      }
    }

    // 2. Search by display name (WORKSPACE-LEVEL - profiles)
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

    // Get avatar URLs from identity table for name matches
    const nameMatchActorIds = nameMatches.map((p) => p.actorId);
    let identityAvatars = new Map<string, string | null>();
    if (nameMatchActorIds.length > 0) {
      const identities = await db
        .select({
          canonicalActorId: orgActorIdentities.canonicalActorId,
          avatarUrl: orgActorIdentities.avatarUrl,
        })
        .from(orgActorIdentities)
        .where(
          and(
            eq(orgActorIdentities.clerkOrgId, workspace.clerkOrgId),
            inArray(orgActorIdentities.canonicalActorId, nameMatchActorIds)
          )
        );
      identityAvatars = new Map(
        identities.map((i) => [i.canonicalActorId, i.avatarUrl])
      );
    }

    const nameResults: ActorSearchResult[] = nameMatches
      .filter((p) => !mentionMatches.some((m) => m.actorId === p.actorId))
      .map((p) => ({
        actorId: p.actorId,
        displayName: p.displayName,
        avatarUrl: identityAvatars.get(p.actorId) ?? null,
        expertiseDomains: [], // Not yet implemented in schema
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

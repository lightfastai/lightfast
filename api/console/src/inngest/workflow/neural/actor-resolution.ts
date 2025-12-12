import type { SourceEvent, SourceActor } from "@repo/console-types";

/**
 * Actor Resolution for Neural Observations
 *
 * STATUS: PLACEHOLDER - Full implementation in Day 4
 *
 * TODO (Day 4 Implementation):
 * 1. Create actor profile tables:
 *    - workspace_actor_profiles (unified profiles with expertise domains)
 *    - workspace_actor_identities (cross-platform identity mapping)
 *
 * 2. Implement three-tier resolution:
 *    - Tier 1 (confidence 1.0): OAuth connection match
 *      - Match sourceEvent.actor.id to user-sources.providerAccountId
 *      - Return linked Clerk user ID
 *
 *    - Tier 2 (confidence 0.85): Email matching
 *      - Match sourceEvent.actor.email to workspace member emails via Clerk API
 *      - Return matched Clerk user ID
 *
 *    - Tier 3 (confidence 0.60): Heuristic matching
 *      - Match by username similarity, display name
 *      - Return best-guess Clerk user ID with low confidence
 *
 * 3. Update observation-capture.ts to call resolveActor()
 *
 * 4. Fire profile update events for actor activity tracking
 *
 * Current behavior: Passthrough - returns source actor as-is
 */

export interface ResolvedActor {
  /** Original actor from source event */
  sourceActor: SourceActor | null;
  /** Resolved workspace user ID (Clerk user ID) - null if unresolved */
  resolvedUserId: string | null;
  /** Resolution confidence: 1.0 (OAuth), 0.85 (email), 0.60 (heuristic), 0 (unresolved) */
  confidence: number;
  /** Resolution method used */
  method: "oauth" | "email" | "heuristic" | "unresolved";
}

/**
 * Resolve source actor to workspace user.
 *
 * PLACEHOLDER: Returns passthrough until Day 4 implementation.
 */
export async function resolveActor(
  _workspaceId: string,
  sourceEvent: SourceEvent
): Promise<ResolvedActor> {
  // TODO (Day 4): Implement three-tier resolution
  // For now, passthrough source actor
  return {
    sourceActor: sourceEvent.actor || null,
    resolvedUserId: null,
    confidence: 0,
    method: "unresolved",
  };
}

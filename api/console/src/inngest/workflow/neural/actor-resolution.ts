import type { SourceEvent, SourceActor } from "@repo/console-types";
import { db } from "@db/console/client";
import { workspaceActorIdentities } from "@db/console/schema";
import { eq, and } from "drizzle-orm";
import { log } from "@vendor/observability/log";
import { clerkClient } from "@vendor/clerk/server";

/**
 * Actor Resolution for Neural Observations
 *
 * Currently implements Tier 2 (email matching) only.
 *
 * Resolution Tiers (from E2E design):
 * - Tier 1 (confidence 1.0): OAuth connection match
 *   TODO: Match sourceEvent.actor.id to user-sources.providerAccountId
 *   Requires adding providerAccountId field to user-sources table
 *
 * - Tier 2 (confidence 0.85): Email matching [IMPLEMENTED]
 *   Match sourceEvent.actor.email to workspace member emails via Clerk API
 *
 * - Tier 3 (confidence 0.60): Heuristic matching
 *   TODO: Match by username similarity, display name
 *   Lower confidence, use as fallback
 */

export interface ResolvedActor {
  /** Original actor from source event */
  sourceActor: SourceActor | null;
  /** Resolved workspace user ID (Clerk user ID) - null if unresolved */
  resolvedUserId: string | null;
  /** Canonical actor ID for this workspace (source:id format) */
  actorId: string | null;
  /** Resolution confidence: 0.85 (email), 0 (unresolved) */
  confidence: number;
  /** Resolution method used */
  method: "oauth" | "email" | "heuristic" | "unresolved";
}

/**
 * Resolve source actor to workspace user.
 *
 * Currently implements email matching only (Tier 2).
 */
export async function resolveActor(
  workspaceId: string,
  clerkOrgId: string,
  sourceEvent: SourceEvent,
): Promise<ResolvedActor> {
  const sourceActor = sourceEvent.actor ?? null;

  if (!sourceActor) {
    return {
      sourceActor: null,
      resolvedUserId: null,
      actorId: null,
      confidence: 0,
      method: "unresolved",
    };
  }

  // Generate canonical actor ID
  const actorId = `${sourceEvent.source}:${sourceActor.id}`;

  // Check if we already have a cached identity mapping
  const existingIdentity = await db.query.workspaceActorIdentities.findFirst({
    where: and(
      eq(workspaceActorIdentities.workspaceId, workspaceId),
      eq(workspaceActorIdentities.source, sourceEvent.source),
      eq(workspaceActorIdentities.sourceId, sourceActor.id),
    ),
  });

  if (existingIdentity?.actorId) {
    log.debug("Using cached actor identity", {
      actorId: existingIdentity.actorId,
      method: existingIdentity.mappingMethod,
    });

    return {
      sourceActor,
      resolvedUserId: existingIdentity.actorId, // This is the resolved user ID
      actorId,
      confidence: existingIdentity.confidenceScore,
      method: existingIdentity.mappingMethod as ResolvedActor["method"],
    };
  }

  // Tier 2: Email matching
  if (sourceActor.email) {
    const resolved = await resolveByEmail(
      workspaceId,
      clerkOrgId,
      sourceEvent.source,
      sourceActor,
    );

    if (resolved) {
      return {
        sourceActor,
        resolvedUserId: resolved.userId,
        actorId,
        confidence: 0.85,
        method: "email",
      };
    }
  }

  // TODO (Future): Tier 1 - OAuth connection match
  // Would need to query user-sources table for providerAccountId match
  // Return confidence 1.0 if matched

  // TODO (Future): Tier 3 - Heuristic matching
  // Match by username similarity, display name
  // Return confidence 0.60 if matched

  // No match found
  return {
    sourceActor,
    resolvedUserId: null,
    actorId,
    confidence: 0,
    method: "unresolved",
  };
}

/**
 * Resolve actor by email matching against Clerk organization members
 */
async function resolveByEmail(
  workspaceId: string,
  clerkOrgId: string,
  source: string,
  actor: SourceActor,
): Promise<{ userId: string } | null> {
  if (!actor.email) return null;

  try {
    // Get Clerk client instance
    const clerk = await clerkClient();

    // Get organization members from Clerk
    const memberships =
      await clerk.organizations.getOrganizationMembershipList({
        organizationId: clerkOrgId,
        limit: 100,
      });

    // Find member with matching email
    for (const membership of memberships.data) {
      const userId = membership.publicUserData?.userId;
      if (!userId) continue;

      // Get user details to check email
      const user = await clerk.users.getUser(userId);
      const userEmails = user.emailAddresses.map((e) =>
        e.emailAddress.toLowerCase(),
      );

      if (userEmails.includes(actor.email.toLowerCase())) {
        // Cache the identity mapping
        await db
          .insert(workspaceActorIdentities)
          .values({
            workspaceId,
            actorId: userId,
            source,
            sourceId: actor.id,
            sourceUsername: actor.name,
            sourceEmail: actor.email,
            mappingMethod: "email",
            confidenceScore: 0.85,
          })
          .onConflictDoNothing();

        log.info("Resolved actor by email", {
          sourceActor: actor.id,
          resolvedUserId: userId,
          email: actor.email,
        });

        return { userId };
      }
    }
  } catch (error) {
    log.warn("Failed to resolve actor by email", {
      actorEmail: actor.email,
      error,
    });
  }

  return null;
}

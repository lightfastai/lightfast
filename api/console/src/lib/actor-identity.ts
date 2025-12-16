import { db } from "@db/console/client";
import { orgActorIdentities } from "@db/console/schema";
import { and, eq } from "drizzle-orm";
import type { SourceActor } from "@repo/console-types";

export interface UpsertIdentityInput {
  clerkOrgId: string;
  canonicalActorId: string;
  source: string;
  sourceId: string;
  sourceActor: SourceActor | null;
  mappingMethod: string;
  confidenceScore: number;
}

/**
 * Upsert org-level actor identity.
 * Creates or updates identity mapping at organization level.
 *
 * This is called during profile updates to ensure the identity record exists
 * at the org level. Identity is org-invariant - same person across all workspaces.
 */
export async function upsertOrgActorIdentity(
  input: UpsertIdentityInput
): Promise<void> {
  const {
    clerkOrgId,
    canonicalActorId,
    source,
    sourceId,
    sourceActor,
    mappingMethod,
    confidenceScore,
  } = input;

  await db
    .insert(orgActorIdentities)
    .values({
      clerkOrgId,
      canonicalActorId,
      source,
      sourceId,
      sourceUsername: sourceActor?.name ?? null,
      sourceEmail: sourceActor?.email ?? null,
      avatarUrl: sourceActor?.avatarUrl ?? null,
      mappingMethod,
      confidenceScore,
    })
    .onConflictDoUpdate({
      target: [
        orgActorIdentities.clerkOrgId,
        orgActorIdentities.source,
        orgActorIdentities.sourceId,
      ],
      set: {
        // Update username/email/avatar if changed
        sourceUsername: sourceActor?.name ?? null,
        sourceEmail: sourceActor?.email ?? null,
        avatarUrl: sourceActor?.avatarUrl ?? null,
        mappedAt: new Date().toISOString(),
      },
    });
}

/**
 * Get identity by canonical actor ID.
 * Returns Clerk user ID and source username for the given actor.
 */
export async function getOrgActorIdentity(
  clerkOrgId: string,
  canonicalActorId: string
): Promise<{ clerkUserId: string | null; sourceUsername: string | null } | null> {
  const identity = await db.query.orgActorIdentities.findFirst({
    where: and(
      eq(orgActorIdentities.clerkOrgId, clerkOrgId),
      eq(orgActorIdentities.canonicalActorId, canonicalActorId)
    ),
    columns: {
      clerkUserId: true,
      sourceUsername: true,
    },
  });

  return identity ?? null;
}

import { db } from "@db/console/client";
import { orgActorIdentities } from "@db/console/schema";
import type { PostTransformActor } from "@repo/console-providers";

interface UpsertIdentityInput {
  canonicalActorId: string;
  clerkOrgId: string;
  confidenceScore: number;
  mappingMethod: string;
  source: string;
  sourceActor: PostTransformActor | null;
  sourceId: string;
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

import { and, eq, isNull } from "drizzle-orm";
import { db, workspaceActorProfiles } from "@db/console";

/**
 * Minimal interface for Clerk external account data needed for actor linking.
 * We define this inline to avoid depending on @clerk/backend types.
 */
interface ClerkExternalAccount {
  provider: string;
  providerUserId?: string;
}

/**
 * Minimal interface for Clerk user data needed for actor linking.
 */
interface ClerkUserForLinking {
  id: string;
  externalAccounts?: ClerkExternalAccount[];
}

/**
 * Lazily links a Clerk user to their GitHub-based actor profile.
 * Called when an authenticated user accesses a workspace.
 *
 * This is a no-op if:
 * - User has no GitHub external account
 * - No actor profile exists for this GitHub ID in the workspace
 * - Profile is already linked to this Clerk user
 */
export async function ensureActorLinked(
  workspaceId: string,
  clerkUser: ClerkUserForLinking,
): Promise<{ linked: boolean; actorId: string | null }> {
  // Find GitHub external account
  const githubAccount = clerkUser.externalAccounts?.find(
    (acc: ClerkExternalAccount) => acc.provider === "oauth_github",
  );

  if (!githubAccount?.providerUserId) {
    return { linked: false, actorId: null };
  }

  const githubNumericId = githubAccount.providerUserId;
  const canonicalActorId = `github:${githubNumericId}`;

  // Lazy link: Update profile if clerkUserId not set
  const result = await db
    .update(workspaceActorProfiles)
    .set({ clerkUserId: clerkUser.id })
    .where(
      and(
        eq(workspaceActorProfiles.workspaceId, workspaceId),
        eq(workspaceActorProfiles.actorId, canonicalActorId),
        isNull(workspaceActorProfiles.clerkUserId),
      ),
    )
    .returning({ actorId: workspaceActorProfiles.actorId });

  return {
    linked: result.length > 0,
    actorId: result[0]?.actorId ?? null,
  };
}

/**
 * Get actor profile for a Clerk user in a workspace.
 * Returns null if user has no linked actor profile.
 */
export async function getActorForClerkUser(
  workspaceId: string,
  clerkUserId: string,
): Promise<{ actorId: string; displayName: string } | null> {
  const profile = await db.query.workspaceActorProfiles.findFirst({
    where: and(
      eq(workspaceActorProfiles.workspaceId, workspaceId),
      eq(workspaceActorProfiles.clerkUserId, clerkUserId),
    ),
    columns: {
      actorId: true,
      displayName: true,
    },
  });

  return profile ?? null;
}

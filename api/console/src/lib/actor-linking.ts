import { and, eq, isNull } from "drizzle-orm";
import { db } from "@db/console/client";
import { orgActorIdentities } from "@db/console/schema";

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
 * Lazily links a Clerk user to their GitHub-based actor identity.
 * Called when an authenticated user accesses ANY workspace in the org.
 *
 * Changed from workspace-level to org-level linking:
 * - Previous: Updated workspaceActorProfiles.clerkUserId per workspace
 * - Now: Updates orgActorIdentities.clerkUserId once per org
 *
 * This is a no-op if:
 * - User has no GitHub external account
 * - No actor identity exists for this GitHub ID in the org
 * - Identity is already linked to this Clerk user
 */
export async function ensureActorLinked(
  clerkOrgId: string,
  clerkUser: ClerkUserForLinking
): Promise<{ linked: boolean; actorId: string | null }> {
  // Find GitHub external account
  const githubAccount = clerkUser.externalAccounts?.find(
    (acc: ClerkExternalAccount) => acc.provider === "oauth_github"
  );

  if (!githubAccount?.providerUserId) {
    return { linked: false, actorId: null };
  }

  const githubNumericId = githubAccount.providerUserId;
  const canonicalActorId = `github:${githubNumericId}`;

  // Lazy link at ORG level: Update identity if clerkUserId not set
  const result = await db
    .update(orgActorIdentities)
    .set({ clerkUserId: clerkUser.id })
    .where(
      and(
        eq(orgActorIdentities.clerkOrgId, clerkOrgId),
        eq(orgActorIdentities.canonicalActorId, canonicalActorId),
        isNull(orgActorIdentities.clerkUserId)
      )
    )
    .returning({ actorId: orgActorIdentities.canonicalActorId });

  return {
    linked: result.length > 0,
    actorId: result[0]?.actorId ?? null,
  };
}

/**
 * Get actor identity for a Clerk user in an org.
 * Returns null if user has no linked actor identity.
 *
 * Changed from workspace-level to org-level lookup:
 * - Previous: Queried workspaceActorProfiles by workspaceId + clerkUserId
 * - Now: Queries orgActorIdentities by clerkOrgId + clerkUserId
 */
export async function getActorForClerkUser(
  clerkOrgId: string,
  clerkUserId: string
): Promise<{ actorId: string; sourceUsername: string | null } | null> {
  const identity = await db.query.orgActorIdentities.findFirst({
    where: and(
      eq(orgActorIdentities.clerkOrgId, clerkOrgId),
      eq(orgActorIdentities.clerkUserId, clerkUserId)
    ),
    columns: {
      canonicalActorId: true,
      sourceUsername: true,
    },
  });

  if (!identity) return null;

  return {
    actorId: identity.canonicalActorId,
    sourceUsername: identity.sourceUsername,
  };
}

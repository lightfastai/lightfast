import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * A user's organization membership from the Clerk API.
 * Minimal shape needed for auth decisions.
 */
export interface UserOrgMembership {
  imageUrl: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string | null;
  role: string;
}

/**
 * Fetch a user's organization memberships from the Clerk API.
 *
 * Strategy: User-centric lookup - fetches user's orgs (typically 1-5)
 * instead of org's members (could be 100+). This is O(user_orgs) vs O(org_size).
 *
 * @param userId - Clerk user ID
 * @returns Array of user's organization memberships (empty if none)
 */
export async function getUserOrgMemberships(
  userId: string
): Promise<UserOrgMembership[]> {
  const clerk = await clerkClient();

  const response = await clerk.users.getOrganizationMembershipList({
    userId,
  });

  return response.data.map((membership) => ({
    organizationId: membership.organization.id,
    organizationSlug: membership.organization.slug,
    organizationName: membership.organization.name,
    role: membership.role,
    imageUrl: membership.organization.imageUrl,
  }));
}

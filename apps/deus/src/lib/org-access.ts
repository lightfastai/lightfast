import { db } from "@db/deus";
import { organizations, organizationMembers } from "@db/deus/schema";
import { eq, and } from "drizzle-orm";

/**
 * Organization access verification result
 */
export type OrgAccessResult =
	| {
			hasAccess: true;
			org: typeof organizations.$inferSelect;
			membership: typeof organizationMembers.$inferSelect;
	  }
	| {
			hasAccess: false;
			reason: "org_not_found" | "not_member";
			org?: typeof organizations.$inferSelect;
	  };

/**
 * Verify user has access to organization
 *
 * This is called in server components to validate org access.
 * Only checks our database - does NOT call GitHub API.
 *
 * Use this for: Read-only pages, listings, etc.
 *
 * @param userId - Clerk user ID
 * @param githubOrgId - GitHub organization ID
 * @returns Access result with org and membership data
 */
export async function verifyOrgAccess(
	userId: string,
	githubOrgId: number,
): Promise<OrgAccessResult> {
	// 1. Find org by GitHub org ID
	const org = await db.query.organizations.findFirst({
		where: eq(organizations.githubOrgId, githubOrgId),
	});

	if (!org) {
		return { hasAccess: false, reason: "org_not_found" };
	}

	// 2. Check if user is member
	const membership = await db.query.organizationMembers.findFirst({
		where: and(
			eq(organizationMembers.organizationId, org.id),
			eq(organizationMembers.userId, userId),
		),
	});

	if (!membership) {
		return { hasAccess: false, reason: "not_member", org };
	}

	return { hasAccess: true, org, membership };
}

/**
 * Find user's first organization
 *
 * Used for redirecting users to their default org.
 *
 * @param userId - Clerk user ID
 * @returns Organization or null
 */
export async function findUserDefaultOrg(userId: string) {
	const userOrg = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, userId),
		with: {
			organization: true,
		},
	});

	return userOrg?.organization ?? null;
}

/**
 * Find organization by GitHub org ID
 *
 * Used when we need to find an org by its immutable GitHub ID.
 *
 * @param githubOrgId - GitHub organization ID
 * @returns Organization or null
 */
export async function findOrgByGitHubId(githubOrgId: number) {
	return await db.query.organizations.findFirst({
		where: eq(organizations.githubOrgId, githubOrgId),
	});
}

/**
 * Check if user is member of any organization that matches GitHub org ID
 *
 * Used for handling slug changes - if slug 404s, try to find by user's orgs.
 *
 * @param userId - Clerk user ID
 * @returns User's organizations
 */
export async function findUserOrganizations(userId: string) {
	const memberships = await db.query.organizationMembers.findMany({
		where: eq(organizationMembers.userId, userId),
		with: {
			organization: true,
		},
	});

	return memberships.map((m) => m.organization);
}


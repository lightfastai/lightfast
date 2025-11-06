import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import type { organizations } from "@db/console/schema";
import { OrganizationsService } from "@repo/console-api-services";

/**
 * Organization access utilities using Clerk RBAC
 *
 * This module provides Clerk-based organization access control, replacing
 * custom database queries with Clerk's built-in organization context and RBAC.
 *
 * Key concepts:
 * - Clerk organizations are linked to Console organizations via clerkOrgId
 * - User's active organization is tracked by Clerk (orgId from auth())
 * - Roles are managed by Clerk (orgRole from auth())
 * - We still query Console database for GitHub-specific data
 *
 * @see org-access.ts - Legacy database-only access control
 */

/**
 * Organization with access information
 */
export interface OrgWithAccess {
	org: typeof organizations.$inferSelect;
	role: string; // Clerk role like "org:admin" or "org:member"
}

/**
 * Result when no organization is active
 */
export interface NoActiveOrg {
	hasOrg: false;
	reason: "no_active_org";
}

/**
 * Result when organization is not found in Console database
 */
export interface OrgNotFound {
	hasOrg: false;
	reason: "org_not_found_in_console";
	clerkOrgId: string;
}

/**
 * Active organization result
 */
export type ActiveOrgResult = OrgWithAccess | NoActiveOrg | OrgNotFound;

/**
 * Get user's active Clerk organization with Console data
 *
 * This function combines Clerk's active organization context with Console's
 * organization data. It returns the organization that the user currently
 * has selected in their Clerk session.
 *
 * Use this when:
 * - You need to know which org the user is currently working in
 * - You want to respect Clerk's organization switcher selection
 * - You need both Clerk role AND GitHub org details
 *
 * @returns Active organization with role, or error reason
 *
 * @example
 * ```ts
 * const activeOrg = await getActiveOrg();
 * if (!activeOrg.hasOrg) {
 *   redirect("/select-organization");
 * }
 * console.log(activeOrg.org.githubOrgSlug, activeOrg.role);
 * ```
 */
export async function getActiveOrg(): Promise<
	| { hasOrg: true; org: typeof organizations.$inferSelect; role: string }
	| NoActiveOrg
	| OrgNotFound
> {
	const { orgId, orgRole } = await auth();

	// No active organization in Clerk session
	if (!orgId) {
		return { hasOrg: false, reason: "no_active_org" };
	}

	// Find corresponding Console organization using service
	const orgService = new OrganizationsService();
	const consoleOrg = await orgService.findByClerkOrgId(orgId);

	if (!consoleOrg) {
		return { hasOrg: false, reason: "org_not_found_in_console", clerkOrgId: orgId };
	}

	return {
		hasOrg: true,
		org: consoleOrg,
		role: orgRole ?? "org:member", // Default to member if role is missing
	};
}

/**
 * Require access to a specific organization by Clerk org slug
 *
 * This function verifies that:
 * 1. User has an active Clerk organization
 * 2. That organization matches the requested slug
 * 3. User has a valid role in the organization
 *
 * Use this for:
 * - Protected pages that operate on a specific organization
 * - API routes that need to verify org access
 * - Any operation that requires organization context
 *
 * @param slug - Clerk organization slug from URL params
 * @throws Error if user doesn't have access or org doesn't match
 * @returns Organization and user's role
 *
 * @example
 * ```ts
 * const { org, role } = await requireOrgAccess("my-org-slug");
 * console.log(`User has ${role} access to ${org.githubOrgSlug}`);
 * ```
 */
export async function requireOrgAccess(
	slug: string,
): Promise<OrgWithAccess> {
	const { orgId: clerkOrgId, orgRole } = await auth();

	// User must have an active organization in Clerk
	if (!clerkOrgId) {
		throw new Error("No active organization. Please select an organization.");
	}

	// Find org by slug to verify it exists using service
	const orgService = new OrganizationsService();
	const org = await orgService.findByClerkOrgSlug(slug);

	if (!org) {
		throw new Error(`Organization not found: ${slug}`);
	}

	// Verify user's active org matches the requested org
	if (org.clerkOrgId !== clerkOrgId) {
		throw new Error(
			"Access denied. Your active organization does not match the requested organization.",
		);
	}

	return {
		org,
		role: orgRole ?? "org:member",
	};
}

/**
 * Check if user has a specific role in their active organization
 *
 * Clerk provides roles like "org:admin" and "org:member". This function
 * checks if the user has the specified role (or higher).
 *
 * Note: Currently does simple string matching. For more complex permission
 * checks, use Clerk's permission system with orgPermissions from auth().
 *
 * @param role - Role to check for ("admin" or "member")
 * @returns True if user has the role
 *
 * @example
 * ```ts
 * if (await hasOrgRole("admin")) {
 *   // Show admin settings
 * }
 * ```
 */
export async function hasOrgRole(role: "admin" | "member"): Promise<boolean> {
	const { orgRole } = await auth();

	if (!orgRole) {
		return false;
	}

	// Map our simple roles to Clerk roles
	const clerkRole = role === "admin" ? "org:admin" : "org:member";

	// Admin has access to everything, so check if they're admin OR the requested role
	if (orgRole === "org:admin") {
		return true;
	}

	return orgRole === clerkRole;
}

/**
 * Get all organizations the user belongs to
 *
 * Fetches all Clerk organizations the user is a member of, and enriches
 * them with Console organization data (GitHub details).
 *
 * Use this for:
 * - Organization switcher/picker UI
 * - Listing user's accessible organizations
 * - Organization navigation
 *
 * @returns List of organizations with Clerk membership info
 *
 * @example
 * ```ts
 * const orgs = await getUserOrganizations();
 * orgs.forEach(org => {
 *   console.log(org.name, org.role, org.deusOrg?.githubOrgSlug);
 * });
 * ```
 */
export async function getUserOrganizations(): Promise<
	{
		id: string;
		name: string;
		slug: string;
		role: string;
		deusOrg: typeof organizations.$inferSelect | null;
	}[]
> {
	const { userId } = await auth();

	if (!userId) {
		return [];
	}

	const clerk = await clerkClient();

	// Get all organizations the user belongs to
	const { data: memberships } = await clerk.users.getOrganizationMembershipList({
		userId,
	});

	// Enrich with Deus data using service
	const orgService = new OrganizationsService();
	const orgsWithData = await Promise.all(
		memberships.map(async (membership) => {
			const clerkOrg = membership.organization;

			// Find corresponding Deus organization
			const deusOrg = await orgService.findByClerkOrgId(clerkOrg.id);

			return {
				id: clerkOrg.id,
				name: clerkOrg.name,
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
				slug: clerkOrg.slug ?? clerkOrg.id,
				role: membership.role,
				deusOrg: deusOrg ?? null,
			};
		}),
	);

	return orgsWithData;
}

/**
 * Get a Deus organization by Clerk org slug
 *
 * Helper function to look up organizations by slug. Does not verify user access.
 *
 * Use this when:
 * - You need to check if a slug exists
 * - You're performing admin operations
 * - Access has already been verified
 * - You need org data without auth checks
 *
 * @param slug - Clerk organization slug
 * @returns Organization or undefined if not found
 *
 * @example
 * ```ts
 * const org = await getOrgBySlug("my-org-slug");
 * if (org) {
 *   console.log(org.githubOrgSlug);
 * }
 * ```
 */
export async function getOrgBySlug(
	slug: string,
): Promise<typeof organizations.$inferSelect | undefined> {
	const orgService = new OrganizationsService();
	const org = await orgService.findByClerkOrgSlug(slug);
	return org ?? undefined;
}

/**
 * Find a Deus organization by GitHub org ID
 *
 * Helper function to look up organizations. Does not verify user access.
 *
 * Use this when:
 * - You need to check if a GitHub org is already claimed
 * - You're performing admin operations
 * - Access has already been verified
 *
 * @param githubOrgId - GitHub organization ID
 * @returns Organization or undefined if not found
 */
export async function findOrgByGitHubId(
	githubOrgId: string | number,
): Promise<typeof organizations.$inferSelect | undefined> {
	const numericOrgId = typeof githubOrgId === "string"
		? parseInt(githubOrgId, 10)
		: githubOrgId;

	if (isNaN(numericOrgId)) {
		return undefined;
	}

	const orgService = new OrganizationsService();
	const org = await orgService.findByGithubOrgId(numericOrgId);
	return org ?? undefined;
}

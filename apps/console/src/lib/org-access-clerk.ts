import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";

/**
 * Organization access utilities using Clerk RBAC
 *
 * This module provides Clerk-based organization access control.
 * Clerk is the source of truth for organizations - no Console DB table.
 *
 * Key concepts:
 * - User's active organization is tracked by Clerk (orgId from auth())
 * - Roles are managed by Clerk (orgRole from auth())
 * - Organizations exist only in Clerk
 */

/**
 * Clerk organization data
 */
export interface ClerkOrgData {
	id: string;
	name: string;
	slug: string;
	imageUrl: string;
	role: string;
}

/**
 * Organization with access information
 */
export interface OrgWithAccess {
	org: {
		id: string;
		name: string;
		slug: string;
		imageUrl: string;
	};
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
 * Result when organization is not found in Clerk
 */
export interface OrgNotFound {
	hasOrg: false;
	reason: "org_not_found_in_clerk";
	clerkOrgId: string;
}

/**
 * Active organization result
 */
export type ActiveOrgResult = OrgWithAccess | NoActiveOrg | OrgNotFound;

/**
 * Get user's active Clerk organization
 *
 * @returns Active organization with role, or error reason
 */
export async function getActiveOrg(): Promise<
	| { hasOrg: true; org: { id: string; name: string; slug: string; imageUrl: string }; role: string }
	| NoActiveOrg
	| OrgNotFound
> {
	const { orgId, orgRole, orgSlug } = await auth();

	// No active organization in Clerk session
	if (!orgId || !orgSlug) {
		return { hasOrg: false, reason: "no_active_org" };
	}

	// Get organization details from Clerk
	const clerk = await clerkClient();
	const clerkOrg = await clerk.organizations.getOrganization({ organizationId: orgId });

	return {
		hasOrg: true,
		org: {
			id: clerkOrg.id,
			name: clerkOrg.name,
			slug: clerkOrg.slug,
			imageUrl: clerkOrg.imageUrl,
		},
		role: orgRole ?? "org:member",
	};
}

/**
 * Require access to a specific organization by Clerk org slug
 *
 * @param slug - Clerk organization slug from URL params
 * @throws Error if user doesn't have access
 * @returns Organization and user's role
 *
 * Note: We fetch the org by slug and verify the user has access to it.
 * We don't check if it matches auth().orgSlug because middleware's
 * organizationSyncOptions may not have synced yet during RSC fetches.
 */
export async function requireOrgAccess(
	slug: string,
): Promise<OrgWithAccess> {
	const { userId } = await auth();

	// User must be authenticated
	if (!userId) {
		throw new Error("Authentication required.");
	}

	// Get organization by slug from URL
	const clerk = await clerkClient();
	let clerkOrg;
	try {
		clerkOrg = await clerk.organizations.getOrganization({ slug });
	} catch {
		throw new Error(`Organization not found: ${slug}`);
	}

	// Verify user has access to this organization
	const membership = await clerk.organizations.getOrganizationMembershipList({
		organizationId: clerkOrg.id,
	});

	const userMembership = membership.data.find(
		(m) => m.publicUserData?.userId === userId,
	);

	if (!userMembership) {
		throw new Error("Access denied to this organization.");
	}

	return {
		org: {
			id: clerkOrg.id,
			name: clerkOrg.name,
			slug: clerkOrg.slug,
			imageUrl: clerkOrg.imageUrl,
		},
		role: userMembership.role,
	};
}

/**
 * Check if user has a specific role in their active organization
 *
 * @param role - Role to check for ("admin" or "member")
 * @returns True if user has the role
 */
export async function hasOrgRole(role: "admin" | "member"): Promise<boolean> {
	const { orgRole } = await auth();

	if (!orgRole) {
		return false;
	}

	// Map our simple roles to Clerk roles
	const clerkRole = role === "admin" ? "org:admin" : "org:member";

	// Admin has access to everything
	if (orgRole === "org:admin") {
		return true;
	}

	return orgRole === clerkRole;
}

/**
 * Get all organizations the user belongs to
 *
 * @returns List of organizations with Clerk membership info
 */
export async function getUserOrganizations(): Promise<ClerkOrgData[]> {
	const { userId } = await auth();

	if (!userId) {
		return [];
	}

	const clerk = await clerkClient();

	// Get all organizations the user belongs to
	const { data: memberships } = await clerk.users.getOrganizationMembershipList({
		userId,
	});

	return memberships.map((membership) => {
		const clerkOrg = membership.organization;
		return {
			id: clerkOrg.id,
			name: clerkOrg.name,
			slug: clerkOrg.slug,
			imageUrl: clerkOrg.imageUrl,
			role: membership.role,
		};
	});
}

/**
 * Get a Clerk organization by slug
 *
 * @param slug - Clerk organization slug
 * @returns Organization or undefined if not found
 */
export async function getOrgBySlug(
	slug: string,
): Promise<{ id: string; name: string; slug: string; imageUrl: string } | undefined> {
	const clerk = await clerkClient();

	try {
		const org = await clerk.organizations.getOrganization({ slug });

		return {
			id: org.id,
			name: org.name,
			slug: org.slug,
			imageUrl: org.imageUrl,
		};
	} catch {
		return undefined;
	}
}

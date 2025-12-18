import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getCachedUserOrgMemberships } from "@repo/console-clerk-cache";

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
 * Require access to a specific organization by Clerk org slug
 *
 * Strategy: User-centric lookup with caching.
 * 1. Fetch org by slug (required for org metadata)
 * 2. Get user's cached memberships
 * 3. Verify user is member of target org
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

	// Get organization by slug from URL (needed for org metadata like name, imageUrl)
	const clerk = await clerkClient();
	let clerkOrg;
	try {
		clerkOrg = await clerk.organizations.getOrganization({ slug });
	} catch {
		throw new Error(`Organization not found: ${slug}`);
	}

	// User-centric membership check (cached)
	const userMemberships = await getCachedUserOrgMemberships(userId);

	const userMembership = userMemberships.find(
		(m) => m.organizationId === clerkOrg.id,
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

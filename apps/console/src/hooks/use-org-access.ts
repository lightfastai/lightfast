"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";

/**
 * Hook to access current organization data from Clerk
 *
 * This hook provides org ID and slug directly from Clerk's client-side cache.
 * No API calls needed - Clerk middleware syncs org state from URL.
 *
 * @returns Current organization ID, slug, and user's role
 * @throws Error if no active organization
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { clerkOrgId, slug, role } = useOrgAccess();
 *   // Use org data...
 * }
 * ```
 */
export function useOrgAccess() {
	const { orgId, orgRole, orgSlug } = useAuth();
	const { organization } = useOrganization();

	if (!orgId || !orgSlug) {
		throw new Error("No active organization. User must select an organization.");
	}

	return {
		/** Clerk organization ID (org_xxx) - use this for all tRPC calls */
		clerkOrgId: orgId,
		/** Organization slug - use this for URLs and slug-based queries */
		slug: orgSlug,
		/** User's role in the organization (e.g., "org:admin", "org:member") */
		role: orgRole || "org:member",
		/** Organization name (if available from Clerk's cache) */
		name: organization?.name,
		/** Organization image URL (if available from Clerk's cache) */
		imageUrl: organization?.imageUrl,
	};
}

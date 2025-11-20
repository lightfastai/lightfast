"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { useAuth } from "@clerk/nextjs";
import { notFound } from "next/navigation";

/**
 * Hook to access current organization data from prefetched cache
 *
 * This hook reads organization data that was prefetched by the org layout,
 * eliminating the need for requireOrgAccess on every page.
 *
 * @returns Current organization data and user's role
 * @throws Redirects to 404 if organization not found
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { org, organizationId, githubOrgId, role } = useOrgAccess();
 *   // Use org data...
 * }
 * ```
 */
export function useOrgAccess() {
	const trpc = useTRPC();
	const { orgId, orgRole } = useAuth();

	if (!orgId) {
		throw new Error("No active organization. User must select an organization.");
	}

	// Use prefetched data from org layout
	// refetchOnMount: false ensures we use the prefetched data
	const { data: org } = useSuspenseQuery({
		...trpc.organization.findByClerkOrgId.queryOptions({
			clerkOrgId: orgId,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
	});

	if (!org) {
		notFound();
	}

	return {
		/** Full organization record from Clerk */
		org,
		/** User's role in the organization (e.g., "org:admin", "org:member") */
		role: orgRole || "org:member",
		/** Clerk organization ID (org_xxx) - use this for all tRPC calls */
		clerkOrgId: org.id,
		/** Organization slug */
		slug: org.slug,
		/** Organization name */
		name: org.name,
		/** Organization image URL */
		imageUrl: org.imageUrl,
	};
}

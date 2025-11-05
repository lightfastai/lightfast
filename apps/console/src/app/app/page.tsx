import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getUserOrganizations } from "~/lib/org-access-clerk";

/**
 * App Entry Point - Org Redirect
 *
 * Redirects authenticated users to their default organization.
 * If user has no organizations, redirects to onboarding.
 */
export default async function AppPage() {
	const { userId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	// Get user's organizations
	const orgs = await getUserOrganizations();

	if (orgs.length === 0 || !orgs[0]) {
		// User has no organizations - send to onboarding
		redirect("/onboarding");
	}

	// Redirect to user's first organization using Clerk org slug
	redirect(`/org/${orgs[0].slug}`);
}

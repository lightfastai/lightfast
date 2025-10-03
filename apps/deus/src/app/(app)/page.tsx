import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { findUserDefaultOrg } from "~/lib/org-access";

/**
 * Root Page - Org Redirect
 *
 * Redirects authenticated users to their default organization.
 * If user has no organizations, redirects to onboarding.
 */
export default async function HomePage() {
	const { userId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	// Find user's default organization
	const org = await findUserDefaultOrg(userId);

	if (!org) {
		// User has no organizations - send to onboarding
		redirect("/onboarding");
	}

	// Redirect to user's default organization
	redirect(`/org/${org.githubOrgSlug}`);
}

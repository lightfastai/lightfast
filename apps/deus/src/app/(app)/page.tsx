import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@db/deus";
import { organizationMembers, organizations } from "@db/deus/schema";
import { eq } from "drizzle-orm";

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

	// Find user's first organization
	const userOrg = await db.query.organizationMembers.findFirst({
		where: eq(organizationMembers.userId, userId),
		with: {
			organization: true,
		},
	});

	if (!userOrg?.organization) {
		// User has no organizations - send to onboarding
		redirect("/onboarding");
	}

	// Redirect to user's default organization
	redirect(`/org/${userOrg.organization.githubOrgSlug}`);
}

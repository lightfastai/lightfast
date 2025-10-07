import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { verifyOrgAccess } from "~/lib/org-access";

export default async function SettingsPage({
	params,
}: {
	params: Promise<{ orgId: string }>;
}) {
	const { userId } = await auth();
	if (!userId) {
		redirect("/sign-in");
	}

	const { orgId } = await params;
	const githubOrgId = parseInt(orgId, 10);

	if (isNaN(githubOrgId)) {
		notFound();
	}

	// Verify access before redirecting
	const access = await verifyOrgAccess(userId, githubOrgId);

	if (!access.hasAccess) {
		redirect("/onboarding");
	}

	// Redirect to github-integration as the default settings page
	redirect(`/org/${orgId}/settings/github-integration`);
}

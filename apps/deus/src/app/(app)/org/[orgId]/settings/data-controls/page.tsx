import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { DataControlsSettings } from "~/components/data-controls-settings";
import { verifyOrgAccess } from "~/lib/org-access";

export default async function DataControlsPage({
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

	// Verify user has access to this organization
	const access = await verifyOrgAccess(userId, githubOrgId);

	if (!access.hasAccess) {
		redirect("/onboarding");
	}

	return <DataControlsSettings />;
}

import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { verifyOrgAccess } from "~/lib/org-access";
import { OrgChatInterface } from "~/components/org-chat-interface";
import { prefetch, trpc } from "@repo/deus-trpc/server";

export default async function OrgHomePage({
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
		if (access.reason === "org_not_found") {
			notFound();
		}
		// User is not a member - send to onboarding
		redirect("/onboarding");
	}

	// Prefetch repositories for this org to avoid loading state
	prefetch(
		trpc.repository.list.queryOptions({
			includeInactive: false,
			organizationId: access.org.id,
		})
	);

	return (
		<OrgChatInterface
			orgId={githubOrgId}
			organizationId={access.org.id}
		/>
	);
}

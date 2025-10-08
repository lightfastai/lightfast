import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

import { requireOrgAccess } from "~/lib/org-access-clerk";
import { OrgChatInterface } from "~/components/org-chat-interface";
import { prefetch, trpc, HydrateClient } from "@repo/deus-trpc/server";

export default async function OrgHomePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { userId } = await auth();
	if (!userId) {
		redirect("/sign-in");
	}

	const { slug } = await params;

	// Verify user has access to this organization
	let access;
	try {
		access = await requireOrgAccess(slug);
	} catch {
		notFound();
	}

	// Prefetch repositories for this org to avoid loading state
	prefetch(
		trpc.repository.list.queryOptions({
			includeInactive: false,
			organizationId: access.org.id,
		})
	);

	return (
		<HydrateClient>
			<OrgChatInterface
				orgId={access.org.githubOrgId}
				organizationId={access.org.id}
				orgSlug={slug}
			/>
		</HydrateClient>
	);
}

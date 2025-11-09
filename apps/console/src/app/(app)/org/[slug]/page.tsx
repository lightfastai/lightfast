import { notFound } from "next/navigation";

import { requireOrgAccess } from "~/lib/org-access-clerk";
import { OrgChatInterface } from "~/components/org-chat-interface";
import { prefetch, trpc, HydrateClient } from "@repo/console-trpc/server";

export default async function OrgHomePage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	// Note: Auth is handled by middleware (auth.protect())
	const { slug } = await params;

	// Verify user has access to this organization
	let access;
	try {
		access = await requireOrgAccess(slug);
	} catch {
		notFound();
	}

	// Note: access.org.id IS the Clerk org ID (primary key)

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

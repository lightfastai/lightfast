import { notFound } from "next/navigation";
import { GitHubIntegrationSettings } from "~/components/github-integration-settings";
import { requireOrgAccess } from "~/lib/org-access-clerk";

export default async function GitHubIntegrationPage({
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

	return <GitHubIntegrationSettings organization={access.org} />;
}

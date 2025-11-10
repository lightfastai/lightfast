import { redirect, notFound } from "next/navigation";
import { requireOrgAccess } from "~/lib/org-access-clerk";

export default async function SettingsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	// Note: Auth is handled by middleware (auth.protect())
	const { slug } = await params;

	// Verify access before redirecting
	try {
		await requireOrgAccess(slug);
	} catch {
		notFound();
	}

	// Redirect to github-integration as the default settings page
	redirect(`/org/${slug}/settings/github-integration`);
}

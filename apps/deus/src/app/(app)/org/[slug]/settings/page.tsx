import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { requireOrgAccess } from "~/lib/org-access-clerk";

export default async function SettingsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { userId } = await auth();
	if (!userId) {
		redirect("/sign-in");
	}

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

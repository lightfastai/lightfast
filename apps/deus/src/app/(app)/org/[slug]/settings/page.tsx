import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { verifyOrgAccess } from "~/lib/org-access";

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
	const access = await verifyOrgAccess(userId, slug);

	if (!access.hasAccess) {
		redirect("/onboarding");
	}

	// Redirect to data-controls as the default settings page
	redirect(`/org/${slug}/settings/data-controls`);
}

import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { EnvironmentsSettings } from "~/components/environments-settings";
import { verifyOrgAccess } from "~/lib/org-access";

export default async function EnvironmentsPage({
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
	const access = await verifyOrgAccess(userId, slug);

	if (!access.hasAccess) {
		redirect("/onboarding");
	}

	return <EnvironmentsSettings />;
}

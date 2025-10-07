import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { findUserOrganizations } from "~/lib/org-access";
import { AuthenticatedHeader } from "~/components/authenticated-header";

export default async function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { userId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	// Fetch user's organizations for the org switcher
	const organizations = await findUserOrganizations(userId);

	return (
		<div className="dark">
			<AuthenticatedHeader organizations={organizations} />
			{children}
		</div>
	);
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserOrganizations } from "~/lib/org-access-clerk";
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
	const organizations = await getUserOrganizations();

	return (
		<div className="dark">
			<AuthenticatedHeader organizations={organizations} />
			{children}
		</div>
	);
}

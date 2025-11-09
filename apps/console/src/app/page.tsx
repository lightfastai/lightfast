import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { authUrl } from "~/lib/related-projects";

/**
 * Console App Root
 *
 * Redirects users to the appropriate destination:
 * - Authenticated users → onboarding (where they can claim/switch orgs)
 * - Unauthenticated users → auth app sign-in
 */
export default async function RootPage() {
	const { userId } = await auth();

	if (userId) {
		redirect("/onboarding/claim-org");
	}

	redirect(`${authUrl}/sign-in`);
}

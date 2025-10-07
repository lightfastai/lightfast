import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

/**
 * Onboarding Entry Point
 *
 * Determines where to send the user in the onboarding flow.
 * For now, redirects to GitHub connect step.
 */
export default async function OnboardingPage() {
	const { userId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	// Redirect to GitHub connect flow
	redirect("/onboarding/connect-github");
}

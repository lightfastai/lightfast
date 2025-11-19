import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * GitHub App Setup Callback
 *
 * This route is called by GitHub after a user installs or configures the GitHub App.
 * It receives the installation_id which we can use for repository access.
 *
 * Flow:
 * 1. User clicks "Install" on GitHub
 * 2. GitHub shows org selector and permissions
 * 3. User confirms installation
 * 4. GitHub redirects to this Setup URL with installation_id
 * 5. We redirect user back to /new page
 *
 * Query Parameters:
 * - installation_id: The GitHub App installation ID
 * - setup_action: "install" | "update"
 * - state: Optional state parameter we passed initially
 *
 * Note: We don't need to store the installation_id here.
 * It will be stored when the user actually connects a repository.
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const installationId = searchParams.get("installation_id");
	const setupAction = searchParams.get("setup_action");

	console.log("GitHub App setup callback:", {
		installationId,
		setupAction,
	});

	// Verify user is authenticated
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.redirect(new URL("/sign-in", request.url));
	}

	// Redirect back to /new page with success message
	// Use the microfrontends proxy URL in development
	const baseUrl =
		process.env.NEXT_PUBLIC_APP_URL ??
		(process.env.NODE_ENV === "production"
			? "https://console.lightfast.ai"
			: "http://localhost:3024"); // Microfrontends proxy port

	const redirectUrl = new URL("/new", baseUrl);

	if (installationId) {
		redirectUrl.searchParams.set("setup", "success");
		redirectUrl.searchParams.set("installation_id", installationId);
	}

	return NextResponse.redirect(redirectUrl);
}

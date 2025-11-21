import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { env } from "~/env";

/**
 * GitHub App Setup Callback
 *
 * This route is called by GitHub after a user installs or configures the GitHub App.
 * It receives the installation_id, then redirects to OAuth flow to get user access token.
 *
 * Flow:
 * 1. User completes GitHub App installation
 * 2. GitHub redirects here with installation_id
 * 3. We redirect to /api/github/auth (OAuth flow)
 * 4. OAuth callback fetches installations and stores in database
 * 5. User redirected back to /account/teams/new page
 *
 * Query Parameters:
 * - installation_id: The GitHub App installation ID
 * - setup_action: "install" | "update"
 * - state: Optional state parameter we passed initially
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

	// Get the base URL for redirects
	const baseUrl =
		env.NEXT_PUBLIC_APP_URL ??
		(env.NEXT_PUBLIC_VERCEL_ENV === "production"
			? "https://console.lightfast.ai"
			: env.NEXT_PUBLIC_VERCEL_ENV === "preview"
				? `https://${process.env.VERCEL_URL}`
				: "http://localhost:3024"); // Microfrontends proxy port

	// Check for custom callback from install route
	const customCallback = request.cookies.get("github_install_callback")?.value;

	// After installation, redirect to OAuth flow to get user access token
	// This will fetch the installations and store them in the database
	const oauthUrl = new URL("/api/github/auth", baseUrl);

	// Pass callback URL to OAuth flow
	const finalCallback = customCallback ?? "/account/teams/new";
	oauthUrl.searchParams.set("callback", finalCallback);

	// Store installation_id to verify after OAuth
	const response = NextResponse.redirect(oauthUrl.toString());

	if (installationId) {
		response.cookies.set("github_setup_installation_id", installationId, {
			httpOnly: true,
			secure: true, // Always secure (use HTTPS in dev)
			sameSite: "strict", // Prevent CSRF
			maxAge: 600, // 10 minutes
			path: "/api/github", // Restrict to GitHub paths
		});
	}

	// Clear install state cookie
	response.cookies.delete("github_install_state");

	return response;
}

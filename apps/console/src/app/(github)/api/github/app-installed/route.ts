import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConsoleBaseUrl } from "~/lib/base-url";

/**
 * GitHub App Installation Callback
 *
 * This route is called by GitHub after a user installs or configures the GitHub App.
 * It receives the installation_id, then redirects to user OAuth flow to get access token.
 *
 * Flow:
 * 1. User completes GitHub App installation
 * 2. GitHub redirects here with installation_id
 * 3. We redirect to /api/github/authorize-user (user OAuth flow)
 * 4. User-authorized callback fetches installations and stores in database
 * 5. User redirected back to application
 *
 * Query Parameters:
 * - installation_id: The GitHub App installation ID
 * - setup_action: "install" | "update"
 * - state: Optional state parameter we passed initially
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const installationId = searchParams.get("installation_id");

	// Verify user is authenticated
	// IMPORTANT: Use treatPendingAsSignedOut: false to allow pending users (users without org)
	// Pending users are in the process of creating their first org/workspace
	const { userId } = await auth({ treatPendingAsSignedOut: false });

	if (!userId) {
		return NextResponse.redirect(new URL("/sign-in", request.url));
	}

	// Get the base URL for redirects
	const baseUrl = getConsoleBaseUrl();

	// Check for custom callback from install route
	const customCallback = request.cookies.get("github_install_callback")?.value;

	// After installation, redirect to user OAuth flow to get user access token
	// This will fetch the installations and store them in the database
	const oauthUrl = new URL("/api/github/authorize-user", baseUrl);

	// Pass callback URL to OAuth flow
	const finalCallback = customCallback ?? "/account/teams/new";
	oauthUrl.searchParams.set("callback", finalCallback);

	// Store installation_id to verify after OAuth
	const response = NextResponse.redirect(oauthUrl.toString());

	if (installationId) {
		response.cookies.set("github_setup_installation_id", installationId, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax", // Allow cookie on redirects
			maxAge: 600, // 10 minutes
			path: "/", // Make available to all routes
		});
	}

	// Clear install state cookie
	response.cookies.delete("github_install_state");

	return response;
}

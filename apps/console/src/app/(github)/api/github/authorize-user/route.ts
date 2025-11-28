import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateOAuthState } from "@repo/console-oauth/state";
import { env } from "~/env";
import { createBaseUrl } from "~/lib/base-url";

/**
 * GitHub User OAuth Authorization
 *
 * Initiates the user OAuth flow by redirecting to GitHub's authorization page.
 * User will be asked to authorize the app to access their account data.
 *
 * This is different from GitHub App installation:
 * - GitHub App installation: Grants app access to repositories
 * - User OAuth: Grants access to user's account data (needed to list installations)
 *
 * Flow:
 * 1. User authorizes the app (OAuth)
 * 2. GitHub redirects to /api/github/user-authorized with code
 * 3. App exchanges code for user access token
 * 4. App fetches user's GitHub App installations
 * 5. App stores installations in database
 */
export function GET(request: NextRequest) {
	const clientId = env.GITHUB_CLIENT_ID;

	// Get the base URL for GitHub OAuth callback
	const baseUrl = createBaseUrl();
	const redirectUri = `${baseUrl}/api/github/user-authorized`;

	// Support custom callback URL via query parameter
	const searchParams = request.nextUrl.searchParams;
	const customCallback = searchParams.get("callback");

	// Generate secure OAuth state with @repo/console-oauth
	const { encoded } = generateOAuthState({
		redirectPath: customCallback ?? undefined,
	});

	// For GitHub Apps, we use OAuth to get a user access token
	// This token allows us to fetch the user's installations
	// IMPORTANT: Send the FULL encoded state to GitHub, not just the token
	// GitHub will return exactly what we send, and we validate against the full encoded state
	const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encoded}`;

	const response = NextResponse.redirect(githubAuthUrl);

	// Set state cookie with encoded state (includes timestamp, nonce, redirectPath)
	// IMPORTANT: Use sameSite: "lax" instead of "strict" because GitHub (external domain)
	// redirects back to our callback. "strict" blocks cookies on external redirects.
	const cookieOptions = {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production", // Only secure in production (localhost doesn't use HTTPS)
		sameSite: "lax" as const, // Allow cookie on top-level navigation from GitHub
		maxAge: 600, // 10 minutes
		path: "/", // Make available to all routes (not just /api/github)
	};

	response.cookies.set("github_oauth_state", encoded, cookieOptions);

	return response;
}

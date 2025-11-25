import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateOAuthState } from "@repo/console-oauth/state";
import { env } from "~/env";

/**
 * GitHub App - Authorization Redirect
 *
 * Initiates the GitHub App OAuth flow by redirecting to GitHub's authorization page.
 * User will be asked to authorize the app to access their installations.
 *
 * Flow:
 * 1. User authorizes the app (OAuth)
 * 2. App fetches user's GitHub App installations (organizations)
 * 3. User selects organization and repository
 * 4. App uses installation ID to access repositories
 */
export function GET(request: NextRequest) {
	const clientId = env.GITHUB_CLIENT_ID;

	// Get the base URL for callback
	// In development, use the microfrontends proxy (port 3024)
	// In production/preview, use the public URL
	const baseUrl =
		env.NEXT_PUBLIC_APP_URL ??
		(env.NEXT_PUBLIC_VERCEL_ENV === "production"
			? "https://console.lightfast.ai"
			: env.NEXT_PUBLIC_VERCEL_ENV === "preview"
				? `https://${process.env.VERCEL_URL}`
				: "http://localhost:3024"); // Microfrontends proxy port

	const redirectUri = `${baseUrl}/api/github/callback`;

	// Support custom callback URL via query parameter
	const searchParams = request.nextUrl.searchParams;
	const customCallback = searchParams.get("callback");

	// Generate secure OAuth state with @repo/console-oauth
	const { state, encoded } = generateOAuthState({
		redirectPath: customCallback ?? undefined,
	});

	// Debug logging
	console.log("GitHub OAuth Auth Debug:", {
		generatedToken: state.token,
		encodedState: encoded,
		customCallback,
	});

	// For GitHub Apps, we still use OAuth to get a user access token
	// This token allows us to fetch the user's installations
	// IMPORTANT: Send the FULL encoded state to GitHub, not just the token
	// GitHub will return exactly what we send, and we validate against the full encoded state
	const response = NextResponse.redirect(
		`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encoded}`,
	);

	// Set state cookie with encoded state (includes timestamp, nonce, redirectPath)
	// IMPORTANT: Use sameSite: "lax" instead of "strict" because GitHub (external domain)
	// redirects back to our callback. "strict" blocks cookies on external redirects.
	response.cookies.set("github_oauth_state", encoded, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production", // Only secure in production (localhost doesn't use HTTPS)
		sameSite: "lax", // Allow cookie on top-level navigation from GitHub
		maxAge: 600, // 10 minutes
		path: "/", // Make available to all routes (not just /api/github)
	});

	return response;
}

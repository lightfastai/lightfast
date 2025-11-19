import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
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

	// Generate a random state parameter to prevent CSRF attacks
	const state = crypto.randomUUID();

	// Support custom callback URL via query parameter
	const searchParams = request.nextUrl.searchParams;
	const customCallback = searchParams.get("callback");

	// For GitHub Apps, we still use OAuth to get a user access token
	// This token allows us to fetch the user's installations
	const response = NextResponse.redirect(
		`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,
	);

	// Set state cookie that expires in 10 minutes
	response.cookies.set("github_oauth_state", state, {
		httpOnly: true,
		secure: env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 600, // 10 minutes
		path: "/",
	});

	// Store custom callback if provided
	if (customCallback) {
		response.cookies.set("github_oauth_callback", customCallback, {
			httpOnly: true,
			secure: env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 600, // 10 minutes
			path: "/",
		});
	}

	return response;
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";

/**
 * GitHub OAuth Token Response
 */
interface GitHubTokenResponse {
	access_token?: string;
	error?: string;
	error_description?: string;
}

/**
 * GitHub App - OAuth Callback Handler
 *
 * Handles the OAuth callback from GitHub after user authorization.
 * Exchanges the authorization code for a user access token.
 * This token is used to fetch the user's GitHub App installations.
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const error = searchParams.get("error");

	// Get the base URL for redirect
	const baseUrl =
		env.NEXT_PUBLIC_APP_URL ??
		(env.NEXT_PUBLIC_VERCEL_ENV === "production"
			? "https://deus.lightfast.ai"
			: env.NEXT_PUBLIC_VERCEL_ENV === "preview"
				? `https://${process.env.VERCEL_URL}`
				: "http://localhost:4107");

	// Check for OAuth errors
	if (error) {
		return NextResponse.redirect(
			`${baseUrl}/?github_error=${encodeURIComponent(error)}`
		);
	}

	// Validate state parameter
	const storedState = request.cookies.get("github_oauth_state")?.value;
	if (!state || !storedState || state !== storedState) {
		return NextResponse.redirect(
			`${baseUrl}/?github_error=invalid_state`
		);
	}

	// Exchange code for access token
	if (!code) {
		return NextResponse.redirect(
			`${baseUrl}/?github_error=missing_code`
		);
	}

	const clientId = env.GITHUB_APP_CLIENT_ID;
	const clientSecret = env.GITHUB_APP_CLIENT_SECRET;

	if (!clientId || !clientSecret) {
		return NextResponse.redirect(
			`${baseUrl}/?github_error=app_not_configured`
		);
	}

	try {
		// Exchange authorization code for access token
		const tokenResponse = await fetch(
			"https://github.com/login/oauth/access_token",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					client_id: clientId,
					client_secret: clientSecret,
					code,
				}),
			}
		);

		const tokenData: GitHubTokenResponse =
			(await tokenResponse.json()) as GitHubTokenResponse;

		if (tokenData.error) {
			return NextResponse.redirect(
				`${baseUrl}/?github_error=${encodeURIComponent(tokenData.error)}`
			);
		}

		const accessToken = tokenData.access_token;

		if (!accessToken) {
			return NextResponse.redirect(
				`${baseUrl}/?github_error=no_access_token`
			);
		}

		// Check for custom callback URL
		const customCallback = request.cookies.get("github_oauth_callback")?.value;
		const redirectUrl = customCallback
			? `${baseUrl}${customCallback}`
			: `${baseUrl}/?github_auth=success`;

		// Redirect back to the app with success
		// The user access token allows us to fetch installations
		const response = NextResponse.redirect(redirectUrl);

		// Store user access token in a secure, httpOnly cookie
		response.cookies.set("github_user_token", accessToken, {
			httpOnly: true,
			secure: env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: 3600, // 1 hour
			path: "/",
		});

		// Clear the state and callback cookies
		response.cookies.delete("github_oauth_state");
		response.cookies.delete("github_oauth_callback");

		return response;
	} catch (err) {
		console.error("GitHub OAuth error:", err);
		return NextResponse.redirect(
			`${baseUrl}/?github_error=exchange_failed`
		);
	}
}

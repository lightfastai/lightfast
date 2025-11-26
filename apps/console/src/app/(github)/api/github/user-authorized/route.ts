import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { validateOAuthState } from "@repo/console-oauth/state";
import { encryptOAuthTokenToCookie } from "@repo/console-oauth/tokens";
import { getUserInstallations } from "@repo/console-octokit-github";
import { createUserTRPCContext, userRouter } from "@api/console";
import { encrypt } from "@repo/lib";
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
 * GitHub User OAuth Callback Handler
 *
 * Handles the OAuth callback from GitHub after user authorization.
 * Exchanges the authorization code for a user access token.
 * This token is used to fetch the user's GitHub App installations.
 *
 * Flow:
 * 1. GitHub redirects here with authorization code
 * 2. Exchange code for user access token
 * 3. Use token to fetch user's GitHub App installations
 * 4. Store installations in database
 * 5. Redirect user back to application
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const error = searchParams.get("error");

	// Get the base URL for redirect
	// In development, use the microfrontends proxy (port 3024)
	// In production/preview, use the public URL
	const baseUrl =
		env.NEXT_PUBLIC_APP_URL ??
		(env.NEXT_PUBLIC_VERCEL_ENV === "production"
			? "https://console.lightfast.ai"
			: env.NEXT_PUBLIC_VERCEL_ENV === "preview"
				? `https://${process.env.VERCEL_URL}`
				: "http://localhost:3024"); // Microfrontends proxy port

	// Check for OAuth errors
	if (error) {
		return NextResponse.redirect(
			`${baseUrl}/?github_error=${encodeURIComponent(error)}`,
		);
	}

	// Validate state parameter with @repo/console-oauth
	const storedStateEncoded = request.cookies.get("github_oauth_state")?.value;

	if (!state || !storedStateEncoded) {
		return NextResponse.redirect(`${baseUrl}/?github_error=invalid_state`);
	}

	const stateValidation = validateOAuthState(state, storedStateEncoded);

	if (!stateValidation.valid) {
		const errorParam =
			stateValidation.error === "expired" ? "state_expired" : "invalid_state";
		return NextResponse.redirect(`${baseUrl}/?github_error=${errorParam}`);
	}

	// Exchange code for access token
	if (!code) {
		return NextResponse.redirect(`${baseUrl}/?github_error=missing_code`);
	}

	const clientId = env.GITHUB_CLIENT_ID;
	const clientSecret = env.GITHUB_CLIENT_SECRET;

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
			},
		);

		const tokenData: GitHubTokenResponse =
			(await tokenResponse.json()) as GitHubTokenResponse;

		if (tokenData.error) {
			return NextResponse.redirect(
				`${baseUrl}/?github_error=${encodeURIComponent(tokenData.error)}`,
			);
		}

		const accessToken = tokenData.access_token;

		if (!accessToken) {
			return NextResponse.redirect(`${baseUrl}/?github_error=no_access_token`);
		}

		// Get Clerk userId
		// IMPORTANT: Use treatPendingAsSignedOut: false to allow pending users (users without org)
		// Pending users are in the process of creating their first org/workspace
		const { userId: clerkUserId } = await auth({
			treatPendingAsSignedOut: false,
		});

		if (!clerkUserId) {
			return NextResponse.redirect(`${baseUrl}/?github_error=unauthorized`);
		}

		// Fetch user's GitHub App installations
		let installationsData: Awaited<ReturnType<typeof getUserInstallations>>;
		try {
			installationsData = await getUserInstallations(accessToken);
		} catch {
			return NextResponse.redirect(
				`${baseUrl}/?github_error=installations_fetch_failed`,
			);
		}

		/**
		 * Store integration in database via tRPC caller
		 * Use direct caller with user auth context instead of service layer
		 * IMPORTANT: Use userRouter (not orgRouter) since this is user-level OAuth data
		 */
		try {
			// Create tRPC context with user authentication from request headers
			const ctx = await createUserTRPCContext({
				headers: request.headers,
			});

			// Create caller with user's auth context
			const caller = userRouter.createCaller(ctx);

			const installationsToStore = installationsData.installations.map((i) => {
				const account = i.account;
				// GitHub API returns account.type as "User" or "Organization"
				const accountType =
					account && "type" in account && account.type === "Organization"
						? ("Organization" as const)
						: ("User" as const);

				// All accounts (both User and Organization) have 'login' field
				const accountLogin = account && "login" in account ? account.login : "";

				return {
					id: String(i.id),
					accountId: String(account?.id ?? ""),
					accountLogin,
					accountType,
					avatarUrl: account?.avatar_url ?? "",
					permissions: i.permissions as Record<string, string>,
					installedAt: new Date().toISOString(),
					lastValidatedAt: new Date().toISOString(),
				};
			});

			await caller.userSources.github.storeOAuthResult({
				accessToken: encrypt(accessToken, env.ENCRYPTION_KEY),
				installations: installationsToStore,
			});
		} catch {
			return NextResponse.redirect(`${baseUrl}/?github_error=database_error`);
		}

		// Get custom callback URL from validated state (if provided during auth)
		const customCallback = stateValidation.state?.redirectPath;

		// Default to success page that shows "You can now close this window"
		const redirectUrl = customCallback
			? `${baseUrl}${customCallback}`
			: `${baseUrl}/github/connected`;

		// Redirect back to the app with success
		const response = NextResponse.redirect(redirectUrl);

		// Store user access token in a secure, httpOnly cookie with encryption
		// SHORT-LIVED: Only 5 minutes - just enough to list installations once
		// We don't need long-term token storage - installation_id is stored in DB
		const encryptedToken = await encryptOAuthTokenToCookie(
			accessToken,
			env.ENCRYPTION_KEY,
		);
		response.cookies.set("github_user_token", encryptedToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax", // Allow cookie on redirects
			maxAge: 300, // 5 minutes
			path: "/", // Make available to all routes
		});

		// Clear the state cookie (nonce prevents replay)
		response.cookies.delete("github_oauth_state");

		return response;
	} catch {
		return NextResponse.redirect(`${baseUrl}/?github_error=exchange_failed`);
	}
}

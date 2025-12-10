import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { validateOAuthState } from "@repo/console-oauth/state";
import { createUserTRPCContext, userRouter } from "@api/console";
import { encrypt } from "@repo/lib";
import { env } from "~/env";
import { createBaseUrl } from "~/lib/base-url";

/**
 * Vercel OAuth Token Response
 */
interface VercelTokenResponse {
	access_token?: string;
	token_type?: string;
	user_id?: string;
	team_id?: string | null;
	installation_id?: string;
	error?: string;
	error_description?: string;
}

/**
 * Vercel OAuth Callback Handler
 *
 * Handles the OAuth callback from Vercel after user authorization.
 * Exchanges the authorization code for an access token.
 *
 * Flow:
 * 1. Vercel redirects here with authorization code
 * 2. Validate OAuth state to prevent CSRF
 * 3. Exchange code for access token
 * 4. Store encrypted token in database
 * 5. Redirect user back to application
 *
 * Query params from Vercel:
 * - code: Authorization code to exchange
 * - state: OAuth state we sent
 * - configurationId: Vercel integration configuration ID
 * - teamId: Vercel team ID (optional, null for personal accounts)
 *
 * @see https://vercel.com/docs/integrations/create-integration
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const code = searchParams.get("code");
	const state = searchParams.get("state");
	const error = searchParams.get("error");
	const configurationId = searchParams.get("configurationId");
	const teamId = searchParams.get("teamId");

	// Get the base URL for redirects
	const baseUrl = createBaseUrl();

	// Check for OAuth errors
	if (error) {
		console.error("[Vercel OAuth] Error from Vercel:", error);
		return NextResponse.redirect(
			`${baseUrl}/?vercel_error=${encodeURIComponent(error)}`,
		);
	}

	// Validate state parameter with @repo/console-oauth
	const storedStateEncoded = request.cookies.get("vercel_oauth_state")?.value;

	if (!state || !storedStateEncoded) {
		console.error("[Vercel OAuth] Missing state parameter");
		return NextResponse.redirect(`${baseUrl}/?vercel_error=invalid_state`);
	}

	const stateValidation = validateOAuthState(state, storedStateEncoded);

	if (!stateValidation.valid) {
		const errorParam =
			stateValidation.error === "expired" ? "state_expired" : "invalid_state";
		console.error("[Vercel OAuth] State validation failed:", stateValidation.error);
		return NextResponse.redirect(`${baseUrl}/?vercel_error=${errorParam}`);
	}

	// Exchange code for access token
	if (!code) {
		console.error("[Vercel OAuth] Missing authorization code");
		return NextResponse.redirect(`${baseUrl}/?vercel_error=missing_code`);
	}

	if (!configurationId) {
		console.error("[Vercel OAuth] Missing configurationId");
		return NextResponse.redirect(`${baseUrl}/?vercel_error=missing_configuration`);
	}

	const clientId = env.VERCEL_CLIENT_SECRET_ID;
	const clientSecret = env.VERCEL_CLIENT_INTEGRATION_SECRET;
	const redirectUri = `${baseUrl}/api/vercel/callback`;

	try {
		// Exchange authorization code for access token
		// Vercel uses application/x-www-form-urlencoded
		const tokenResponse = await fetch(
			"https://api.vercel.com/v2/oauth/access_token",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: new URLSearchParams({
					client_id: clientId,
					client_secret: clientSecret,
					code,
					redirect_uri: redirectUri,
				}),
			},
		);

		const tokenData: VercelTokenResponse =
			(await tokenResponse.json()) as VercelTokenResponse;

		if (tokenData.error) {
			console.error("[Vercel OAuth] Token exchange error:", tokenData.error, tokenData.error_description);
			return NextResponse.redirect(
				`${baseUrl}/?vercel_error=${encodeURIComponent(tokenData.error)}`,
			);
		}

		const accessToken = tokenData.access_token;

		if (!accessToken) {
			console.error("[Vercel OAuth] No access token in response");
			return NextResponse.redirect(`${baseUrl}/?vercel_error=no_access_token`);
		}

		// Get Clerk userId
		// IMPORTANT: Use treatPendingAsSignedOut: false to allow pending users
		const { userId: clerkUserId } = await auth({
			treatPendingAsSignedOut: false,
		});

		if (!clerkUserId) {
			console.error("[Vercel OAuth] User not authenticated");
			return NextResponse.redirect(`${baseUrl}/?vercel_error=unauthorized`);
		}

		// Store integration in database via tRPC caller
		try {
			const ctx = await createUserTRPCContext({
				headers: request.headers,
			});

			const caller = userRouter.createCaller(ctx);

			await caller.userSources.vercel.storeOAuthResult({
				accessToken: encrypt(accessToken, env.ENCRYPTION_KEY),
				userId: tokenData.user_id ?? "",
				teamId: teamId ?? tokenData.team_id ?? undefined,
				configurationId,
			});

			console.log("[Vercel OAuth] Successfully stored OAuth result for user:", clerkUserId);
		} catch (dbError) {
			console.error("[Vercel OAuth] Database error:", dbError);
			return NextResponse.redirect(`${baseUrl}/?vercel_error=database_error`);
		}

		// Get custom callback URL from validated state
		const customCallback = stateValidation.state?.redirectPath;

		// Default to success page
		const redirectUrl = customCallback
			? `${baseUrl}${customCallback}`
			: `${baseUrl}/vercel/connected`;

		const response = NextResponse.redirect(redirectUrl);

		// Clear the state cookie
		response.cookies.delete("vercel_oauth_state");

		return response;
	} catch (exchangeError) {
		console.error("[Vercel OAuth] Token exchange failed:", exchangeError);
		return NextResponse.redirect(`${baseUrl}/?vercel_error=exchange_failed`);
	}
}

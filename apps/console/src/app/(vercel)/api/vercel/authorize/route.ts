import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { generateOAuthState } from "@repo/console-oauth/state";
import { env } from "~/env";

/**
 * Vercel Integration Authorization
 *
 * Initiates the Vercel Integration installation flow via the marketplace.
 * User will be redirected to install the integration from Vercel's marketplace.
 *
 * Flow:
 * 1. User clicks "Connect Vercel" in Lightfast
 * 2. This route redirects to Vercel Integration marketplace install page
 * 3. User selects team/scope and authorizes the integration
 * 4. Vercel redirects to /api/vercel/callback with authorization code
 * 5. We exchange code for access token
 * 6. Store token to make API calls on user's behalf
 *
 * IMPORTANT: Vercel Integrations use the marketplace install flow, NOT the
 * /oauth/authorize endpoint. The /oauth/authorize endpoint is for "Sign in
 * with Vercel" OAuth apps, which is a different feature.
 *
 * @see https://vercel.com/docs/integrations/create-integration
 */
export function GET(request: NextRequest) {
	// Support custom redirect path via query parameter
	const searchParams = request.nextUrl.searchParams;
	const customRedirect = searchParams.get("redirect");

	// Generate secure OAuth state with @repo/console-oauth
	const { encoded } = generateOAuthState({
		redirectPath: customRedirect ?? undefined,
	});

	// Build Vercel Integration marketplace install URL
	const integrationSlug = env.VERCEL_INTEGRATION_SLUG;
	const marketplaceUrl = new URL(`https://vercel.com/integrations/${integrationSlug}/new`);
	// Pass state to be forwarded to our callback
	marketplaceUrl.searchParams.set("state", encoded);

	const response = NextResponse.redirect(marketplaceUrl.toString());

	// Set state cookie with encoded state (includes timestamp, nonce, redirectPath)
	// IMPORTANT: Use sameSite: "lax" because Vercel (external domain)
	// redirects back to our callback. "strict" blocks cookies on external redirects.
	const cookieOptions = {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax" as const,
		maxAge: 600, // 10 minutes
		path: "/",
	};

	response.cookies.set("vercel_oauth_state", encoded, cookieOptions);

	return response;
}

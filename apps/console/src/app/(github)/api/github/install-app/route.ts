import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "~/env";

/**
 * GitHub App - Installation Flow
 *
 * Redirects user to GitHub App installation page where they can:
 * 1. Select which organization/account to install on
 * 2. Choose which repositories to grant access to
 * 3. Review and accept permissions
 *
 * After installation, GitHub redirects to the Setup URL with installation_id
 *
 * Flow:
 * 1. User clicks "Connect GitHub" → /api/github/install-app
 * 2. Redirect to GitHub App installation page
 * 3. User selects org and repositories
 * 4. GitHub redirects to /api/github/app-installed with installation_id
 * 5. App-installed route triggers user OAuth flow to get access token
 * 6. User-authorized callback fetches installations and stores in database
 */
export function GET(request: NextRequest) {
	const appSlug = env.GITHUB_APP_SLUG;

	// GitHub App installation URL
	// This shows the org selector and permissions page
	const installUrl = new URL(
		`https://github.com/apps/${appSlug}/installations/new`,
	);

	// Optional: Pre-select a specific organization
	const searchParams = request.nextUrl.searchParams;
	const suggestedTargetId = searchParams.get("target_id");
	const customCallback = searchParams.get("callback");

	if (suggestedTargetId) {
		installUrl.searchParams.set("target_id", suggestedTargetId);
	}

	// State parameter to track after setup
	const state = crypto.randomUUID();

	// Store state in cookie for validation in setup route
	const response = NextResponse.redirect(installUrl.toString());

	const cookieOptions = {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax" as const, // Allow cookie on redirects
		maxAge: 600, // 10 minutes
		path: "/", // Make available to all routes
	};

	response.cookies.set("github_install_state", state, cookieOptions);

	// Store custom callback if provided
	if (customCallback) {
		response.cookies.set("github_install_callback", customCallback, cookieOptions);
	}

	return response;
}

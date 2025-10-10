import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUserInstallations } from "@repo/deus-octokit-github";

/**
 * GitHub App - Fetch User Installations
 *
 * Fetches all GitHub App installations accessible to the authenticated user.
 * This includes personal account and organization installations.
 *
 * Returns GitHub's installation objects directly.
 */
export async function GET(request: NextRequest) {
	// Get user access token from cookie
	const userToken = request.cookies.get("github_user_token")?.value;

	if (!userToken) {
		return NextResponse.json(
			{ error: "Not authenticated. Please authorize the app first." },
			{ status: 401 }
		);
	}

	try {
		// Return GitHub installations directly
		const data = await getUserInstallations(userToken);
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error fetching GitHub App installations:", error);
		return NextResponse.json(
			{
				error: "Failed to fetch installations",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

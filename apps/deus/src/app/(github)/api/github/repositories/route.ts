import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getInstallationRepositories } from "~/lib/github-app";

/**
 * GitHub App - Fetch Installation Repositories
 *
 * Fetches repositories accessible through a specific GitHub App installation.
 * Requires an installation ID as a query parameter.
 *
 * Query parameters:
 * - installationId: The GitHub App installation ID
 *
 * Returns GitHub's repository objects directly.
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const installationIdParam = searchParams.get("installationId");

	if (!installationIdParam) {
		return NextResponse.json(
			{ error: "Missing installationId parameter" },
			{ status: 400 }
		);
	}

	const installationId = Number.parseInt(installationIdParam, 10);

	if (Number.isNaN(installationId)) {
		return NextResponse.json(
			{ error: "Invalid installationId parameter" },
			{ status: 400 }
		);
	}

	try {
		// Return GitHub repositories directly
		const data = await getInstallationRepositories(installationId);
		return NextResponse.json(data);
	} catch (error) {
		console.error("Error fetching GitHub repositories:", error);
		return NextResponse.json(
			{
				error: "Failed to fetch repositories",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

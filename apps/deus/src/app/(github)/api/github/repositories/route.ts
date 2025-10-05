import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getInstallationRepositories } from "~/lib/github-app";
import { db } from "@db/deus/client";
import { organizations } from "@db/deus";
import { eq } from "drizzle-orm";

/**
 * GitHub App - Fetch Installation Repositories
 *
 * Fetches repositories accessible through a specific GitHub App installation.
 * Accepts either installationId OR githubOrgId as query parameters.
 *
 * Query parameters:
 * - installationId: The GitHub App installation ID (direct lookup)
 * - githubOrgId: The GitHub organization ID (looks up installation from DB)
 *
 * Returns:
 * - repositories: Array of GitHub repository objects
 * - installationId: The installation ID used (for connecting repos)
 */
export async function GET(request: NextRequest) {
	const searchParams = request.nextUrl.searchParams;
	const installationIdParam = searchParams.get("installationId");
	const githubOrgIdParam = searchParams.get("githubOrgId");

	let installationId: number;

	// Support both installationId and githubOrgId parameters
	if (githubOrgIdParam) {
		// Look up organization to get installation ID
		const githubOrgId = Number.parseInt(githubOrgIdParam, 10);

		if (Number.isNaN(githubOrgId)) {
			return NextResponse.json(
				{ error: "Invalid githubOrgId parameter" },
				{ status: 400 }
			);
		}

		const org = await db
			.select()
			.from(organizations)
			.where(eq(organizations.githubOrgId, githubOrgId))
			.limit(1);

		if (!org[0]) {
			return NextResponse.json(
				{ error: "Organization not found" },
				{ status: 404 }
			);
		}

		installationId = org[0].githubInstallationId;
	} else if (installationIdParam) {
		// Direct installation ID lookup
		installationId = Number.parseInt(installationIdParam, 10);

		if (Number.isNaN(installationId)) {
			return NextResponse.json(
				{ error: "Invalid installationId parameter" },
				{ status: 400 }
			);
		}
	} else {
		return NextResponse.json(
			{ error: "Missing installationId or githubOrgId parameter" },
			{ status: 400 }
		);
	}

	try {
		// Fetch repositories from GitHub
		const data = await getInstallationRepositories(installationId);

		// Return repositories array and the installation ID
		return NextResponse.json({
			repositories: data.repositories,
			installationId,
		});
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

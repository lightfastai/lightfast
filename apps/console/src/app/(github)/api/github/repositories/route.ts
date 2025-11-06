import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createGitHubApp, getInstallationRepositories } from "@repo/console-octokit-github";
import { OrganizationsService } from "@repo/console-api-services";
import { env } from "~/env";

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

		const organizationsService = new OrganizationsService();
		const org = await organizationsService.findByGithubOrgId(githubOrgId);

		if (!org) {
			return NextResponse.json(
				{ error: "Organization not found" },
				{ status: 404 }
			);
		}

		installationId = org.githubInstallationId;
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
		const app = createGitHubApp({
			appId: env.GITHUB_APP_ID,
			privateKey: env.GITHUB_APP_PRIVATE_KEY,
		});
		const data = await getInstallationRepositories(app, installationId);

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

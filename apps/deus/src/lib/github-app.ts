import { App } from "octokit";
import { Octokit } from "octokit";
import type { components } from "@octokit/openapi-types";
import { env } from "~/env";

/**
 * GitHub App Authentication Utilities
 *
 * Uses Octokit for GitHub App authentication and API interactions.
 * Handles installation tokens, user installations, and repository access.
 */

/**
 * GitHub App Installation (using Octokit types)
 */
export type GitHubInstallation = components["schemas"]["installation"];

/**
 * GitHub Repository (using Octokit types)
 */
export type GitHubRepository = components["schemas"]["repository"];

/**
 * Get or create the GitHub App instance
 */
function getApp(): App {
	return new App({
		appId: env.GITHUB_APP_ID,
		privateKey: env.GITHUB_APP_PRIVATE_KEY,
	});
}

/**
 * Get all installations for the authenticated user
 *
 * This requires a user access token (from OAuth), not an installation token.
 *
 * @param userAccessToken - User's OAuth access token
 * @returns List of installations accessible to the user
 */
export async function getUserInstallations(
	userAccessToken: string
): Promise<{ installations: GitHubInstallation[] }> {
	const octokit = new Octokit({ auth: userAccessToken });

	const { data } = await octokit.request("GET /user/installations", {
		headers: {
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});

	return data;
}

/**
 * Get repositories accessible to an installation
 *
 * @param installationId - The GitHub App installation ID
 * @returns List of repositories
 */
export async function getInstallationRepositories(installationId: number) {
	const app = getApp();
	const octokit = await app.getInstallationOctokit(installationId);

	const { data } = await octokit.request("GET /installation/repositories", {
		headers: {
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});

	return data;
}

/**
 * Get pull request details from GitHub API
 *
 * @param installationId - The GitHub App installation ID
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param pullNumber - Pull request number
 * @returns Pull request data
 */
export async function getPullRequest(
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number
) {
	const app = getApp();
	const octokit = await app.getInstallationOctokit(installationId);

	const { data } = await octokit.request(
		"GET /repos/{owner}/{repo}/pulls/{pull_number}",
		{
			owner,
			repo,
			pull_number: pullNumber,
			headers: {
				"X-GitHub-Api-Version": "2022-11-28",
			},
		}
	);

	return data;
}

/**
 * Get repository details from GitHub API
 *
 * @param installationId - The GitHub App installation ID
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Repository data
 */
export async function getRepository(
	installationId: number,
	owner: string,
	repo: string
) {
	const app = getApp();
	const octokit = await app.getInstallationOctokit(installationId);

	const { data } = await octokit.request("GET /repos/{owner}/{repo}", {
		owner,
		repo,
		headers: {
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});

	return data;
}

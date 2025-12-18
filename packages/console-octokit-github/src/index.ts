import { App, Octokit } from "octokit";
import type { components } from "@octokit/openapi-types";

/**
 * GitHub App Authentication Utilities
 *
 * Shared GitHub/Octokit utilities for the Deus application.
 * Handles GitHub App authentication, installation tokens, and repository access.
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
 * Organization membership role
 */
export type OrgMembershipRole = "admin" | "member";

/**
 * GitHub App configuration
 */
export interface GitHubAppConfig {
	appId: string;
	privateKey: string;
}

/**
 * Format GitHub private key from environment variable
 *
 * Handles various formats that environment variables might use:
 * - Literal \n characters (common in Vercel/other platforms)
 * - Missing PEM headers/footers
 * - Extra quotes or whitespace
 */
export function formatPrivateKey(key: string): string {
	let formatted = key;

	// Remove any surrounding quotes
	formatted = formatted.replace(/^["']|["']$/g, "");

	// Replace literal \n with actual newlines
	formatted = formatted.replace(/\\n/g, "\n");

	// Ensure proper PEM format with headers
	if (!formatted.includes("BEGIN")) {
		// Key is likely base64 only, add headers
		formatted = `-----BEGIN RSA PRIVATE KEY-----\n${formatted}\n-----END RSA PRIVATE KEY-----`;
	}

	return formatted;
}

/**
 * Create a GitHub App instance
 *
 * @param config - GitHub App configuration
 * @param shouldFormatKey - Whether to format the private key (default: false)
 * @returns GitHub App instance
 */
export function createGitHubApp(
	config: GitHubAppConfig,
	shouldFormatKey = false,
): App {
	const privateKey = shouldFormatKey
		? formatPrivateKey(config.privateKey)
		: config.privateKey;

	return new App({
		appId: config.appId,
		privateKey,
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
	userAccessToken: string,
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
 * @param app - GitHub App instance
 * @param installationId - The GitHub App installation ID
 * @returns List of repositories
 */
export async function getInstallationRepositories(
	app: App,
	installationId: number,
) {
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
 * @param app - GitHub App instance
 * @param installationId - The GitHub App installation ID
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param pullNumber - Pull request number
 * @returns Pull request data
 */
export async function getPullRequest(
	app: App,
	installationId: number,
	owner: string,
	repo: string,
	pullNumber: number,
) {
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
		},
	);

	return data;
}

/**
 * Get repository details from GitHub API
 *
 * @param app - GitHub App instance
 * @param installationId - The GitHub App installation ID
 * @param owner - Repository owner
 * @param repo - Repository name
 * @returns Repository data
 */
export async function getRepository(
	app: App,
	installationId: number,
	owner: string,
	repo: string,
) {
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

/**
 * List open pull requests for a repository
 *
 * @param app - GitHub App instance
 * @param installationId - The GitHub App installation ID
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param limit - Maximum number of PRs to fetch (default: 50)
 * @returns List of open pull requests
 */
export async function listOpenPullRequests(
	app: App,
	installationId: number,
	owner: string,
	repo: string,
	limit = 50,
) {
	const octokit = await app.getInstallationOctokit(installationId);

	const { data } = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
		owner,
		repo,
		state: "open",
		per_page: limit,
		sort: "updated",
		direction: "desc",
		headers: {
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});

	return data;
}

/**
 * Get authenticated user's GitHub profile
 *
 * @param userAccessToken - User's OAuth access token
 * @returns User profile data including login (username)
 */
export async function getAuthenticatedUser(userAccessToken: string) {
	const octokit = new Octokit({ auth: userAccessToken });

	const { data } = await octokit.request("GET /user", {
		headers: {
			"X-GitHub-Api-Version": "2022-11-28",
		},
	});

	return data;
}

/**
 * Get user's organization membership details
 *
 * @param userAccessToken - User's OAuth access token
 * @param org - Organization login/slug
 * @param username - GitHub username to check
 * @returns Membership data including role
 * @throws Error if user is not a member of the organization
 */
export async function getOrganizationMembership(
	userAccessToken: string,
	org: string,
	username: string,
): Promise<{ role: OrgMembershipRole; state: string }> {
	const octokit = new Octokit({ auth: userAccessToken });

	const { data } = await octokit.request(
		"GET /orgs/{org}/memberships/{username}",
		{
			org,
			username,
			headers: {
				"X-GitHub-Api-Version": "2022-11-28",
			},
		},
	);

	return {
		role: data.role as OrgMembershipRole,
		state: data.state,
	};
}

// Export throttled utilities
export { createThrottledOctokit, getThrottledInstallationOctokit, checkRateLimit } from "./throttled";

// Export GitHub content service
export { GitHubContentService } from "./github-content";
export type { ChangedFile, FetchedFile } from "./github-content";

// Export configuration detector
export { ConfigDetectorService } from "./config-detector";
export type { ConfigDetectionResult } from "./config-detector";

// Export webhook types
export type {
  PushEvent,
  InstallationEvent,
  InstallationRepositoriesEvent,
  RepositoryEvent,
  WebhookEvent,
  // Neural observation event types
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
  DiscussionEvent,
} from "./webhook-types";

// Export GitHub environment configuration
export { githubEnv } from "./env";

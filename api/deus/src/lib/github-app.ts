import { App } from "octokit";

import { env } from "../env";

/**
 * GitHub App Authentication Utilities for API Package
 *
 * Uses Octokit for GitHub App authentication and API interactions.
 * Handles installation tokens and repository/PR access.
 */

/**
 * Format GitHub private key from environment variable
 *
 * Handles various formats that environment variables might use:
 * - Literal \n characters (common in Vercel/other platforms)
 * - Missing PEM headers/footers
 * - Extra quotes or whitespace
 */
function formatPrivateKey(key: string): string {
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
 * Get or create the GitHub App instance
 */
function getApp(): App {
  const privateKey = formatPrivateKey(env.GITHUB_APP_PRIVATE_KEY);

  return new App({
    appId: env.GITHUB_APP_ID,
    privateKey,
  });
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
  pullNumber: number,
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
    },
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
  repo: string,
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

/**
 * List open pull requests for a repository
 *
 * @param installationId - The GitHub App installation ID
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param limit - Maximum number of PRs to fetch (default: 50)
 * @returns List of open pull requests
 */
export async function listOpenPullRequests(
  installationId: number,
  owner: string,
  repo: string,
  limit = 50,
) {
  const app = getApp();
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

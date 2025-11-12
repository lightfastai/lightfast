import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createGitHubApp, getThrottledInstallationOctokit, GitHubContentService } from "@repo/console-octokit-github";
import { env } from "~/env";

/**
 * GitHub App - Fetch repository lightfast.yml content
 *
 * Query parameters:
 * - fullName: "owner/repo"
 * - installationId: GitHub App installation ID
 * - ref (optional): branch/tag/sha; defaults to repo default branch
 *
 * Returns:
 * - exists: boolean
 * - path?: string
 * - content?: string
 * - sha?: string
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fullName = searchParams.get("fullName");
  const installationIdParam = searchParams.get("installationId");
  const refParam = searchParams.get("ref");

  if (!fullName || !installationIdParam) {
    return NextResponse.json(
      { error: "Missing fullName or installationId parameter" },
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

  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) {
    return NextResponse.json({ error: "Invalid fullName format" }, { status: 400 });
  }

  try {
    const app = createGitHubApp({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY });
    const octokit = await getThrottledInstallationOctokit(app, installationId);
    const contentService = new GitHubContentService(octokit);

    // Resolve default branch if ref not provided
    let ref: string;
    if (refParam) {
      ref = refParam;
    } else {
      const { data: repoInfo } = await octokit.request("GET /repos/{owner}/{repo}", {
        owner,
        repo,
        headers: { "X-GitHub-Api-Version": "2022-11-28" },
      });
      ref = repoInfo.default_branch;
    }

    // Try common config file names
    const candidates = [
      "lightfast.yml",
      ".lightfast.yml",
      "lightfast.yaml",
      ".lightfast.yaml",
    ];

    for (const path of candidates) {
      const file = await contentService.fetchSingleFile(owner, repo, path, ref);
      if (file) {
        return NextResponse.json({ exists: true, path, content: file.content, sha: file.sha });
      }
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error("Error fetching repository config:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch repository config",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}


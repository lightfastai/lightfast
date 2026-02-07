/**
 * GitHub Backfill Connector
 *
 * Fetches historical PRs, issues, and releases from GitHub API,
 * adapts them into webhook-compatible shapes, and transforms them
 * using the existing battle-tested transformers.
 */
import {
  createGitHubApp,
  getThrottledInstallationOctokit,
} from "@repo/console-octokit-github";
import {
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
} from "@repo/console-webhooks/transformers";
import type { SourceEvent, TransformContext } from "@repo/console-types";
import type { BackfillConnector, BackfillConfig, BackfillPage } from "../types.js";
import {
  adaptGitHubPRForTransformer,
  adaptGitHubIssueForTransformer,
  adaptGitHubReleaseForTransformer,
  parseGitHubRateLimit,
} from "../adapters/github.js";

type GitHubCursor = { page: number };

class GitHubBackfillConnector implements BackfillConnector<GitHubCursor> {
  readonly provider = "github" as const;
  readonly supportedEntityTypes = ["pull_request", "issue", "release"];
  readonly defaultEntityTypes = ["pull_request", "issue", "release"];

  async validateScopes(_config: BackfillConfig): Promise<void> {
    // GitHub App installations have permissions set at install time.
    // No runtime scope validation needed.
  }

  async fetchPage(
    config: BackfillConfig,
    entityType: string,
    cursor: GitHubCursor | null,
  ): Promise<BackfillPage<GitHubCursor>> {
    const sourceConfig = config.sourceConfig;
    const installationId = Number(sourceConfig.installationId);
    const repoFullName = sourceConfig.repoFullName as string;

    // Create GitHub App and get throttled Octokit for installation
    const app = createGitHubApp({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
    });
    const octokit = await getThrottledInstallationOctokit(app, installationId);

    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) {
      throw new Error(`Invalid repoFullName: ${repoFullName}`);
    }

    const page = cursor?.page ?? 1;
    const context: TransformContext = {
      deliveryId: `backfill-${config.integrationId}-${entityType}-p${page}`,
      receivedAt: new Date(),
    };

    switch (entityType) {
      case "pull_request":
        return this.fetchPullRequests(octokit, owner, repo, page, config.since, context);
      case "issue":
        return this.fetchIssues(octokit, owner, repo, page, config.since, context);
      case "release":
        return this.fetchReleases(octokit, owner, repo, page, config.since, context);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async fetchPullRequests(
    octokit: Awaited<ReturnType<typeof getThrottledInstallationOctokit>>,
    owner: string,
    repo: string,
    page: number,
    since: string,
    context: TransformContext,
  ): Promise<BackfillPage<GitHubCursor>> {
    const response = await octokit.rest.pulls.list({
      owner,
      repo,
      state: "all",
      sort: "updated",
      direction: "desc",
      per_page: 100,
      page,
    });

    const repoData = { full_name: `${owner}/${repo}`, html_url: `https://github.com/${owner}/${repo}`, id: 0 };
    const sinceDate = new Date(since);

    // Filter items within the time window
    const filtered = response.data.filter(pr => new Date(pr.updated_at) >= sinceDate);

    const events: SourceEvent[] = [];
    for (const pr of filtered) {
      try {
        const adapted = adaptGitHubPRForTransformer(pr as unknown as Record<string, unknown>, repoData as unknown as Record<string, unknown>);
        const event = transformGitHubPullRequest(adapted, context);
        events.push(event);
      } catch (err) {
        console.error(`[GitHubBackfill] Failed to transform PR #${pr.number}:`, err);
      }
    }

    const rateLimit = parseGitHubRateLimit(response.headers as Record<string, string>);

    // Continue if page was full AND all items were within window
    const hasMore = response.data.length === 100 && filtered.length === response.data.length;

    return {
      events,
      nextCursor: hasMore ? { page: page + 1 } : null,
      rawCount: response.data.length,
      rateLimit,
    };
  }

  private async fetchIssues(
    octokit: Awaited<ReturnType<typeof getThrottledInstallationOctokit>>,
    owner: string,
    repo: string,
    page: number,
    since: string,
    context: TransformContext,
  ): Promise<BackfillPage<GitHubCursor>> {
    const response = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state: "all",
      sort: "updated",
      since, // GitHub Issues API handles since filtering server-side
      per_page: 100,
      page,
    });

    const repoData = { full_name: `${owner}/${repo}`, html_url: `https://github.com/${owner}/${repo}`, id: 0 };

    // Filter out PRs (items with pull_request key are PRs, not issues)
    const issuesOnly = response.data.filter(item => !item.pull_request);

    const events: SourceEvent[] = [];
    for (const issue of issuesOnly) {
      try {
        const adapted = adaptGitHubIssueForTransformer(issue as unknown as Record<string, unknown>, repoData as unknown as Record<string, unknown>);
        const event = transformGitHubIssue(adapted, context);
        events.push(event);
      } catch (err) {
        console.error(`[GitHubBackfill] Failed to transform issue #${issue.number}:`, err);
      }
    }

    const rateLimit = parseGitHubRateLimit(response.headers as Record<string, string>);
    const hasMore = response.data.length === 100;

    return {
      events,
      nextCursor: hasMore ? { page: page + 1 } : null,
      rawCount: response.data.length,
      rateLimit,
    };
  }

  private async fetchReleases(
    octokit: Awaited<ReturnType<typeof getThrottledInstallationOctokit>>,
    owner: string,
    repo: string,
    page: number,
    since: string,
    context: TransformContext,
  ): Promise<BackfillPage<GitHubCursor>> {
    const response = await octokit.rest.repos.listReleases({
      owner,
      repo,
      per_page: 100,
      page,
    });

    const repoData = { full_name: `${owner}/${repo}`, html_url: `https://github.com/${owner}/${repo}`, id: 0 };
    const sinceDate = new Date(since);

    // Filter releases within the time window
    const filtered = response.data.filter(release => {
      const publishedAt = release.published_at || release.created_at;
      return publishedAt ? new Date(publishedAt) >= sinceDate : false;
    });

    const events: SourceEvent[] = [];
    for (const release of filtered) {
      try {
        const adapted = adaptGitHubReleaseForTransformer(release as unknown as Record<string, unknown>, repoData as unknown as Record<string, unknown>);
        const event = transformGitHubRelease(adapted, context);
        events.push(event);
      } catch (err) {
        console.error(`[GitHubBackfill] Failed to transform release ${release.tag_name}:`, err);
      }
    }

    const rateLimit = parseGitHubRateLimit(response.headers as Record<string, string>);
    const hasMore = response.data.length === 100 && filtered.length === response.data.length;

    return {
      events,
      nextCursor: hasMore ? { page: page + 1 } : null,
      rawCount: response.data.length,
      rateLimit,
    };
  }
}

export const githubBackfillConnector = new GitHubBackfillConnector();

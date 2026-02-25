/**
 * GitHub Backfill Connector
 *
 * Fetches historical PRs, issues, and releases from GitHub API using the
 * installation token from the Gateway token vault. Produces webhook-shaped
 * payloads (adapter output) ready for direct ingestion through Gateway's
 * service auth endpoint.
 */
import type { BackfillConnector, BackfillConfig, BackfillPage, BackfillWebhookEvent } from "../types.js";
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
    // resourceName holds "owner/repo", providerResourceId holds the numeric GitHub repo ID
    const resource = config.resource;
    if (!resource.resourceName) {
      throw new Error(`No resource found for GitHub backfill (installationId: ${config.installationId})`);
    }

    const repoFullName = resource.resourceName;
    const repoId = Number(resource.providerResourceId);  // Real repo ID — fixes check-event-allowed gate

    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) {
      throw new Error(`Invalid resourceName (expected owner/repo): ${repoFullName}`);
    }

    const repoData = {
      full_name: repoFullName,
      html_url: `https://github.com/${repoFullName}`,
      id: repoId,
    };

    const page = cursor?.page ?? 1;

    switch (entityType) {
      case "pull_request":
        return this.fetchPullRequests(config, owner, repo, page, repoData);
      case "issue":
        return this.fetchIssues(config, owner, repo, page, repoData);
      case "release":
        return this.fetchReleases(config, owner, repo, page, repoData);
      default:
        throw new Error(`Unsupported entity type: ${entityType}`);
    }
  }

  private async fetchPullRequests(
    config: BackfillConfig,
    owner: string,
    repo: string,
    page: number,
    repoData: { full_name: string; html_url: string; id: number },
  ): Promise<BackfillPage<GitHubCursor>> {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
    url.searchParams.set("state", "all");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("direction", "desc");
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status} fetching PRs for ${owner}/${repo}`);
    }

    const data = (await response.json()) as Array<Record<string, unknown>>;
    const sinceDate = new Date(config.since);

    const filtered = data.filter(pr => new Date(pr.updated_at as string) >= sinceDate);

    const events: BackfillWebhookEvent[] = filtered.map((pr) => ({
      deliveryId: `backfill-${config.installationId}-${config.resource.providerResourceId}-pr-${pr.number as number}`,
      eventType: "pull_request",
      payload: adaptGitHubPRForTransformer(pr, repoData as unknown as Record<string, unknown>),
    }));

    const rateLimit = parseGitHubRateLimit(Object.fromEntries(response.headers.entries()));
    const hasMore = data.length === 100 && filtered.length === data.length;

    return {
      events,
      nextCursor: hasMore ? { page: page + 1 } : null,
      rawCount: data.length,
      rateLimit,
    };
  }

  private async fetchIssues(
    config: BackfillConfig,
    owner: string,
    repo: string,
    page: number,
    repoData: { full_name: string; html_url: string; id: number },
  ): Promise<BackfillPage<GitHubCursor>> {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/issues`);
    url.searchParams.set("state", "all");
    url.searchParams.set("sort", "updated");
    url.searchParams.set("since", config.since);  // GitHub Issues API handles since server-side
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status} fetching issues for ${owner}/${repo}`);
    }

    const data = (await response.json()) as Array<Record<string, unknown>>;

    // Filter out PRs (items with pull_request key are PRs, not issues)
    const issuesOnly = data.filter(item => !item.pull_request);

    const events: BackfillWebhookEvent[] = issuesOnly.map((issue) => ({
      deliveryId: `backfill-${config.installationId}-${config.resource.providerResourceId}-issue-${issue.number as number}`,
      eventType: "issues",
      payload: adaptGitHubIssueForTransformer(issue, repoData as unknown as Record<string, unknown>),
    }));

    const rateLimit = parseGitHubRateLimit(Object.fromEntries(response.headers.entries()));
    const hasMore = data.length === 100;

    return {
      events,
      nextCursor: hasMore ? { page: page + 1 } : null,
      rawCount: data.length,
      rateLimit,
    };
  }

  private async fetchReleases(
    config: BackfillConfig,
    owner: string,
    repo: string,
    page: number,
    repoData: { full_name: string; html_url: string; id: number },
  ): Promise<BackfillPage<GitHubCursor>> {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/releases`);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status} fetching releases for ${owner}/${repo}`);
    }

    const data = (await response.json()) as Array<Record<string, unknown>>;
    const sinceDate = new Date(config.since);

    const filtered = data.filter(release => {
      const publishedAt = (release.published_at ?? release.created_at) as string | undefined;
      return publishedAt ? new Date(publishedAt) >= sinceDate : false;
    });

    const events: BackfillWebhookEvent[] = filtered.map((release) => ({
      deliveryId: `backfill-${config.installationId}-${config.resource.providerResourceId}-release-${release.id as number}`,
      eventType: "release",
      payload: adaptGitHubReleaseForTransformer(release, repoData as unknown as Record<string, unknown>),
    }));

    const rateLimit = parseGitHubRateLimit(Object.fromEntries(response.headers.entries()));
    const hasMore = data.length === 100 && filtered.length === data.length;

    return {
      events,
      nextCursor: hasMore ? { page: page + 1 } : null,
      rawCount: data.length,
      rateLimit,
    };
  }
}

export const githubBackfillConnector = new GitHubBackfillConnector();

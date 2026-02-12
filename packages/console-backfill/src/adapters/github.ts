/**
 * GitHub API → webhook shape adapters
 *
 * Wrap API list responses into webhook-compatible envelopes so existing
 * transformers produce identical SourceEvent output. This reuses battle-tested
 * transformer code and guarantees sourceId equivalence by construction.
 */
import type {
  PullRequestEvent,
  IssuesEvent,
  ReleaseEvent,
} from "@octokit/webhooks-types";

/**
 * Adapt a GitHub PR from list API into a PullRequestEvent shape.
 *
 * Maps state to action:
 * - state === "open" → action: "opened"
 * - state === "closed" → action: "closed"
 *   (transformer detects merge via pr.merged to produce effectiveAction: "merged")
 *
 * Note: list API does NOT return additions/deletions/changed_files.
 */
export function adaptGitHubPRForTransformer(
  pr: Record<string, unknown>,
  repo: Record<string, unknown>,
): PullRequestEvent {
  const state = pr.state as string;
  const action = state === "open" ? "opened" : "closed";

  return {
    action,
    pull_request: pr,
    repository: repo,
    sender: pr.user,
  } as unknown as PullRequestEvent;
}

/**
 * Adapt a GitHub Issue from list API into an IssuesEvent shape.
 *
 * Maps state to action:
 * - state === "open" → action: "opened"
 * - state === "closed" → action: "closed"
 */
export function adaptGitHubIssueForTransformer(
  issue: Record<string, unknown>,
  repo: Record<string, unknown>,
): IssuesEvent {
  const state = issue.state as string;
  const action = state === "open" ? "opened" : "closed";

  return {
    action,
    issue,
    repository: repo,
    sender: issue.user,
  } as unknown as IssuesEvent;
}

/**
 * Adapt a GitHub Release from list API into a ReleaseEvent shape.
 *
 * All listed releases are published, so action is always "published".
 */
export function adaptGitHubReleaseForTransformer(
  release: Record<string, unknown>,
  repo: Record<string, unknown>,
): ReleaseEvent {
  return {
    action: "published",
    release,
    repository: repo,
    sender: release.author,
  } as unknown as ReleaseEvent;
}

/**
 * Parse GitHub rate limit info from response headers.
 */
export function parseGitHubRateLimit(headers: Record<string, string>): {
  remaining: number;
  resetAt: Date;
  limit: number;
} | undefined {
  const remaining = headers["x-ratelimit-remaining"];
  const reset = headers["x-ratelimit-reset"];
  const limit = headers["x-ratelimit-limit"];

  if (!remaining || !reset || !limit) return undefined;

  return {
    remaining: parseInt(remaining, 10),
    resetAt: new Date(parseInt(reset, 10) * 1000),
    limit: parseInt(limit, 10),
  };
}

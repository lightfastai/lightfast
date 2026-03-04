/**
 * GitHub API → webhook shape adapters
 *
 * Wrap API list responses into webhook-compatible envelopes so existing
 * transformers produce identical PostTransformEvent output. This reuses battle-tested
 * transformer code and guarantees sourceId equivalence by construction.
 */
import type {
  PreTransformGitHubPullRequestEvent,
  PreTransformGitHubIssuesEvent,
  PreTransformGitHubReleaseEvent,
} from "@repo/console-webhooks";

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
): PreTransformGitHubPullRequestEvent {
  const state = pr.state as string;
  const action = state === "open" ? "opened" : "closed";

  return {
    action,
    pull_request: pr,
    repository: repo,
    sender: pr.user,
  } as unknown as PreTransformGitHubPullRequestEvent;
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
): PreTransformGitHubIssuesEvent {
  const state = issue.state as string;
  const action = state === "open" ? "opened" : "closed";

  return {
    action,
    issue,
    repository: repo,
    sender: issue.user,
  } as unknown as PreTransformGitHubIssuesEvent;
}

/**
 * Adapt a GitHub Release from list API into a ReleaseEvent shape.
 *
 * All listed releases are published, so action is always "published".
 */
export function adaptGitHubReleaseForTransformer(
  release: Record<string, unknown>,
  repo: Record<string, unknown>,
): PreTransformGitHubReleaseEvent {
  return {
    action: "published",
    release,
    repository: repo,
    sender: release.author,
  } as unknown as PreTransformGitHubReleaseEvent;
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

  const remainingNum = parseInt(remaining, 10);
  const resetNum = parseInt(reset, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(remainingNum) || isNaN(resetNum) || isNaN(limitNum)) return undefined;

  return {
    remaining: remainingNum,
    resetAt: new Date(resetNum * 1000),
    limit: limitNum,
  };
}

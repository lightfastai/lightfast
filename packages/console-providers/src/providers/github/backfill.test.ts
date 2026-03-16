import { describe, expect, it } from "vitest";
import type { z } from "zod";
import {
  type githubIssueSchema,
  type githubPullRequestSchema,
  parseGitHubRateLimit,
} from "./api";
import {
  adaptGitHubIssueForTransformer,
  adaptGitHubPRForTransformer,
} from "./backfill";

const repo = {
  full_name: "owner/repo",
  html_url: "https://github.com/owner/repo",
  id: 12_345,
};

const basePR: z.infer<typeof githubPullRequestSchema> = {
  id: 42,
  number: 1,
  title: "Test PR",
  state: "open",
  body: null,
  user: { login: "alice", id: 1, avatar_url: "" },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  closed_at: null,
  merged_at: null,
  merge_commit_sha: null,
  draft: false,
  html_url: "https://github.com/owner/repo/pull/1",
  head: { ref: "feature", sha: "abc123" },
  base: { ref: "main", sha: "def456" },
};

const baseIssue: z.infer<typeof githubIssueSchema> = {
  id: 100,
  number: 10,
  title: "Test Issue",
  state: "open",
  body: null,
  user: { login: "alice", id: 1, avatar_url: "" },
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  closed_at: null,
  html_url: "https://github.com/owner/repo/issues/10",
};

describe("adaptGitHubPRForTransformer", () => {
  it("maps open PR to action: opened", () => {
    const pr = { ...basePR, state: "open", number: 1 };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect(result.action).toBe("opened");
  });

  it("maps closed PR to action: closed", () => {
    const pr = { ...basePR, state: "closed", number: 2, merged: false };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect(result.action).toBe("closed");
  });

  it("maps merged PR (state: closed, merged: true) to action: closed", () => {
    // Transformer handles merge detection separately via pr.merged
    const pr = { ...basePR, state: "closed", number: 3, merged: true };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect(result.action).toBe("closed");
  });

  it("output has pull_request, repository, sender fields", () => {
    const pr = { ...basePR, state: "open", number: 4 };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect(result).toMatchObject({
      action: "opened",
      pull_request: {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        html_url: pr.html_url,
        head: { ref: pr.head.ref, sha: pr.head.sha },
        base: { ref: pr.base.ref, sha: pr.base.sha },
      },
      repository: repo,
      sender: pr.user,
    });
  });

  it("sender equals pr.user", () => {
    const user = { login: "bob", id: 99 };
    const pr = { ...basePR, number: 5, user };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect(result.sender).toBe(user);
  });

  it("repository is passed through from repo parameter", () => {
    const customRepo = {
      full_name: "other/repo",
      html_url: "https://github.com/other/repo",
      id: 99,
    };
    const pr = { ...basePR, number: 6 };
    const result = adaptGitHubPRForTransformer(pr, customRepo);
    expect(result.repository).toBe(customRepo);
  });

  it("derives merged=true from merged_at when merged field is absent", () => {
    const pr = {
      ...basePR,
      state: "closed",
      number: 7,
      merged_at: "2024-01-01T00:00:00Z",
    };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect((result.pull_request as Record<string, unknown>).merged).toBe(true);
  });

  it("derives merged=false when merged_at is null and merged is absent", () => {
    const pr = { ...basePR, state: "closed", number: 8, merged_at: null };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect((result.pull_request as Record<string, unknown>).merged).toBe(false);
  });
});

describe("adaptGitHubIssueForTransformer", () => {
  it("maps open issue to action: opened", () => {
    const issue = { ...baseIssue, state: "open", number: 10 };
    const result = adaptGitHubIssueForTransformer(issue, repo);
    expect(result.action).toBe("opened");
  });

  it("maps closed issue to action: closed", () => {
    const issue = { ...baseIssue, state: "closed", number: 11 };
    const result = adaptGitHubIssueForTransformer(issue, repo);
    expect(result.action).toBe("closed");
  });

  it("output has issue, repository, sender fields", () => {
    const issue = { ...baseIssue, number: 12 };
    const result = adaptGitHubIssueForTransformer(issue, repo);
    expect(result).toMatchObject({
      action: "opened",
      issue: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
        state: issue.state,
      },
      repository: repo,
      sender: issue.user,
    });
  });

  it("sender equals issue.user", () => {
    const user = { login: "carol", id: 77 };
    const issue = { ...baseIssue, number: 13, user };
    const result = adaptGitHubIssueForTransformer(issue, repo);
    expect(result.sender).toBe(user);
  });
});

describe("parseGitHubRateLimit", () => {
  it("parses valid headers and returns rate limit info", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "5000",
    });
    const result = parseGitHubRateLimit(headers);
    expect(result).not.toBeNull();
    expect(result!.remaining).toBe(4999);
    expect(result!.limit).toBe(5000);
    expect(result!.resetAt).toEqual(new Date(1_700_000_000 * 1000));
  });

  it("resetAt is Unix seconds multiplied by 1000", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "100",
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "5000",
    });
    const result = parseGitHubRateLimit(headers);
    expect(result!.resetAt.getTime()).toBe(1_700_000_000 * 1000);
  });

  it("returns null when x-ratelimit-remaining is missing", () => {
    const headers = new Headers({
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "5000",
    });
    expect(parseGitHubRateLimit(headers)).toBeNull();
  });

  it("returns null when x-ratelimit-reset is missing", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-limit": "5000",
    });
    expect(parseGitHubRateLimit(headers)).toBeNull();
  });

  it("returns null when x-ratelimit-limit is missing", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-reset": "1700000000",
    });
    expect(parseGitHubRateLimit(headers)).toBeNull();
  });

  it("returns null for empty headers", () => {
    expect(parseGitHubRateLimit(new Headers())).toBeNull();
  });

  it("returns null when headers contain non-numeric values", () => {
    const headers = new Headers({
      "x-ratelimit-remaining": "abc",
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "5000",
    });
    expect(parseGitHubRateLimit(headers)).toBeNull();
  });
});

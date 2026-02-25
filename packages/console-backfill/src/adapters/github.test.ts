import { describe, it, expect } from "vitest";
import {
  adaptGitHubPRForTransformer,
  adaptGitHubIssueForTransformer,
  adaptGitHubReleaseForTransformer,
  parseGitHubRateLimit,
} from "./github";

const repo = { full_name: "owner/repo", html_url: "https://github.com/owner/repo", id: 12345 };

describe("adaptGitHubPRForTransformer", () => {
  it("maps open PR to action: opened", () => {
    const pr = { state: "open", number: 1, user: { login: "alice" } };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect(result.action).toBe("opened");
  });

  it("maps closed PR to action: closed", () => {
    const pr = { state: "closed", number: 2, user: { login: "alice" }, merged: false };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect(result.action).toBe("closed");
  });

  it("maps merged PR (state: closed, merged: true) to action: closed", () => {
    // Transformer handles merge detection separately via pr.merged
    const pr = { state: "closed", number: 3, user: { login: "alice" }, merged: true };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect(result.action).toBe("closed");
  });

  it("output has pull_request, repository, sender fields", () => {
    const pr = { state: "open", number: 4, user: { login: "alice" } };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect(result).toMatchObject({
      action: "opened",
      pull_request: pr,
      repository: repo,
      sender: pr.user,
    });
  });

  it("sender equals pr.user", () => {
    const user = { login: "bob", id: 99 };
    const pr = { state: "open", number: 5, user };
    const result = adaptGitHubPRForTransformer(pr, repo);
    expect(result.sender).toBe(user);
  });

  it("repository is passed through from repo parameter", () => {
    const customRepo = { full_name: "other/repo", html_url: "https://github.com/other/repo", id: 99 };
    const pr = { state: "open", number: 6, user: { login: "alice" } };
    const result = adaptGitHubPRForTransformer(pr, customRepo as unknown as Record<string, unknown>);
    expect(result.repository).toBe(customRepo);
  });
});

describe("adaptGitHubIssueForTransformer", () => {
  it("maps open issue to action: opened", () => {
    const issue = { state: "open", number: 10, user: { login: "alice" } };
    const result = adaptGitHubIssueForTransformer(issue, repo);
    expect(result.action).toBe("opened");
  });

  it("maps closed issue to action: closed", () => {
    const issue = { state: "closed", number: 11, user: { login: "alice" } };
    const result = adaptGitHubIssueForTransformer(issue, repo);
    expect(result.action).toBe("closed");
  });

  it("output has issue, repository, sender fields", () => {
    const issue = { state: "open", number: 12, user: { login: "alice" } };
    const result = adaptGitHubIssueForTransformer(issue, repo);
    expect(result).toMatchObject({
      action: "opened",
      issue,
      repository: repo,
      sender: issue.user,
    });
  });

  it("sender equals issue.user", () => {
    const user = { login: "carol", id: 77 };
    const issue = { state: "open", number: 13, user };
    const result = adaptGitHubIssueForTransformer(issue, repo);
    expect(result.sender).toBe(user);
  });
});

describe("adaptGitHubReleaseForTransformer", () => {
  it("always produces action: published regardless of input state", () => {
    const release = { id: 1, author: { login: "alice" }, tag_name: "v1.0.0" };
    const result = adaptGitHubReleaseForTransformer(release, repo);
    expect(result.action).toBe("published");
  });

  it("output has release, repository, sender fields", () => {
    const release = { id: 2, author: { login: "alice" }, tag_name: "v2.0.0" };
    const result = adaptGitHubReleaseForTransformer(release, repo);
    expect(result).toMatchObject({
      action: "published",
      release,
      repository: repo,
      sender: release.author,
    });
  });

  it("sender equals release.author", () => {
    const author = { login: "dave", id: 55 };
    const release = { id: 3, author, tag_name: "v3.0.0" };
    const result = adaptGitHubReleaseForTransformer(release, repo);
    expect(result.sender).toBe(author);
  });
});

describe("parseGitHubRateLimit", () => {
  it("parses valid headers and returns rate limit info", () => {
    const headers = {
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "5000",
    };
    const result = parseGitHubRateLimit(headers);
    expect(result).not.toBeUndefined();
    expect(result!.remaining).toBe(4999);
    expect(result!.limit).toBe(5000);
    expect(result!.resetAt).toEqual(new Date(1700000000 * 1000));
  });

  it("resetAt is Unix seconds multiplied by 1000", () => {
    const headers = {
      "x-ratelimit-remaining": "100",
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "5000",
    };
    const result = parseGitHubRateLimit(headers);
    expect(result!.resetAt.getTime()).toBe(1700000000 * 1000);
  });

  it("returns undefined when x-ratelimit-remaining is missing", () => {
    const headers = {
      "x-ratelimit-reset": "1700000000",
      "x-ratelimit-limit": "5000",
    };
    expect(parseGitHubRateLimit(headers)).toBeUndefined();
  });

  it("returns undefined when x-ratelimit-reset is missing", () => {
    const headers = {
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-limit": "5000",
    };
    expect(parseGitHubRateLimit(headers)).toBeUndefined();
  });

  it("returns undefined when x-ratelimit-limit is missing", () => {
    const headers = {
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-reset": "1700000000",
    };
    expect(parseGitHubRateLimit(headers)).toBeUndefined();
  });

  it("returns undefined for empty object", () => {
    expect(parseGitHubRateLimit({})).toBeUndefined();
  });
});

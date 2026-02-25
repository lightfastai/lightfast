/**
 * Adapter → Transformer round-trip tests
 *
 * The backfill system's core invariant: adapter output passed through the
 * real transformer must produce a valid SourceEvent with a non-empty sourceId.
 *
 * If a transformer starts accessing a field the list API doesn't provide
 * (e.g. pr.additions), these tests surface it immediately instead of
 * silently dropping backfilled events in production.
 */
import { describe, it, expect, vi } from "vitest";

// Skip env validation for transitive @db/console imports
vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
});
import {
  adaptGitHubPRForTransformer,
  adaptGitHubIssueForTransformer,
  adaptGitHubReleaseForTransformer,
} from "./github";
import {
  adaptVercelDeploymentForTransformer,
} from "./vercel";
import {
  transformGitHubPullRequest,
  transformGitHubIssue,
  transformGitHubRelease,
  transformVercelDeployment,
} from "@repo/console-webhooks";

// Minimal TransformContext — matches { deliveryId: string, receivedAt: Date }
const context = { deliveryId: "backfill-roundtrip-test", receivedAt: new Date() };

/**
 * Realistic GitHub list API PR response.
 * Fields sourced from https://docs.github.com/en/rest/pulls/pulls#list-pull-requests
 * Note: list API does NOT return additions/deletions/changed_files.
 */
const githubListPR = {
  number: 42,
  state: "closed",
  merged: true,
  draft: false,
  title: "feat: add backfill support",
  body: "Implements historical data backfill.\n\nFixes #10",
  html_url: "https://github.com/owner/repo/pull/42",
  user: { id: 1234, login: "alice", avatar_url: "https://avatars.githubusercontent.com/u/1234" },
  head: {
    ref: "feat/backfill",
    sha: "abc123def456",
    repo: { full_name: "alice/repo" },
  },
  base: {
    ref: "main",
    sha: "000111222333",
    repo: { full_name: "owner/repo" },
  },
  merge_commit_sha: "merge123abc",
  updated_at: "2026-01-20T10:00:00Z",
  created_at: "2026-01-18T08:00:00Z",
  requested_reviewers: [{ login: "bob" }],
  assignees: [{ login: "alice" }],
  labels: [{ name: "enhancement" }],
  // additions, deletions, changed_files intentionally omitted — not in list API
};

const githubListIssue = {
  number: 10,
  state: "open",
  title: "Support historical data import",
  body: "We need backfill capabilities for onboarding.",
  html_url: "https://github.com/owner/repo/issues/10",
  user: { id: 5678, login: "carol", avatar_url: "https://avatars.githubusercontent.com/u/5678" },
  updated_at: "2026-01-19T12:00:00Z",
  created_at: "2026-01-15T09:00:00Z",
  assignees: [{ login: "carol" }],
  labels: [{ name: "feature-request" }],
};

const githubListRelease = {
  id: 999,
  tag_name: "v2.0.0",
  name: "Version 2.0.0",
  body: "Major release with backfill support.",
  target_commitish: "main",
  draft: false,
  prerelease: false,
  author: { id: 1234, login: "alice", avatar_url: "https://avatars.githubusercontent.com/u/1234" },
  published_at: "2026-01-20T14:00:00Z",
  created_at: "2026-01-20T13:00:00Z",
  html_url: "https://github.com/owner/repo/releases/tag/v2.0.0",
};

const repoData = {
  full_name: "owner/repo",
  html_url: "https://github.com/owner/repo",
  id: 12345,
};

const vercelListDeployment = {
  uid: "dpl-abc123xyz",
  name: "my-app",
  url: "my-app-abc123.vercel.app",
  projectId: "prj-xyz",
  readyState: "READY",
  created: 1700000000000,
  meta: {
    githubCommitSha: "abc123def456",
    githubCommitRef: "main",
    githubCommitMessage: "feat: add feature",
    githubCommitAuthorName: "alice",
    githubCommitAuthorLogin: "alice",
    githubOrg: "owner",
    githubRepo: "repo",
  },
};

describe("GitHub PR: adapter → transformer round-trip", () => {
  const adapted = adaptGitHubPRForTransformer(
    githubListPR as unknown as Record<string, unknown>,
    repoData as unknown as Record<string, unknown>,
  );

  it("transformer does not throw", () => {
    expect(() => transformGitHubPullRequest(adapted, context)).not.toThrow();
  });

  it("produces a SourceEvent with non-empty sourceId", () => {
    const event = transformGitHubPullRequest(adapted, context);
    expect(event.sourceId).toBeTruthy();
    expect(event.sourceId.length).toBeGreaterThan(0);
  });

  it("produces a SourceEvent with non-empty title", () => {
    const event = transformGitHubPullRequest(adapted, context);
    expect(event.title).toBeTruthy();
  });

  it("source is github", () => {
    const event = transformGitHubPullRequest(adapted, context);
    expect(event.source).toBe("github");
  });

  it("sourceId contains repo and PR number", () => {
    const event = transformGitHubPullRequest(adapted, context);
    expect(event.sourceId).toContain("owner/repo");
    expect(event.sourceId).toContain("42");
  });

  it("actor is populated from pr.user", () => {
    const event = transformGitHubPullRequest(adapted, context);
    expect(event.actor).toBeDefined();
    expect(event.actor!.name).toBe("alice");
  });

  it("occurredAt is a valid, parseable ISO timestamp", () => {
    const event = transformGitHubPullRequest(adapted, context);
    const parsed = new Date(event.occurredAt);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it("references include PR, branch, and commit refs", () => {
    const event = transformGitHubPullRequest(adapted, context);
    const refTypes = event.references.map((r) => r.type);
    expect(refTypes).toContain("pr");
    expect(refTypes).toContain("branch");
    expect(refTypes).toContain("commit");
  });

  it("merged PR produces merged sourceType", () => {
    const event = transformGitHubPullRequest(adapted, context);
    expect(event.sourceType).toContain("merged");
  });

  it("open PR produces opened sourceType", () => {
    const openPR = adaptGitHubPRForTransformer(
      { ...githubListPR, state: "open", merged: false } as unknown as Record<string, unknown>,
      repoData as unknown as Record<string, unknown>,
    );
    const event = transformGitHubPullRequest(openPR, context);
    expect(event.sourceType).toContain("opened");
  });
});

describe("GitHub Issue: adapter → transformer round-trip", () => {
  const adapted = adaptGitHubIssueForTransformer(
    githubListIssue as unknown as Record<string, unknown>,
    repoData as unknown as Record<string, unknown>,
  );

  it("transformer does not throw", () => {
    expect(() => transformGitHubIssue(adapted, context)).not.toThrow();
  });

  it("produces a SourceEvent with non-empty sourceId", () => {
    const event = transformGitHubIssue(adapted, context);
    expect(event.sourceId).toBeTruthy();
    expect(event.sourceId).toContain("10");
  });

  it("source is github", () => {
    const event = transformGitHubIssue(adapted, context);
    expect(event.source).toBe("github");
  });

  it("actor is populated from issue.user", () => {
    const event = transformGitHubIssue(adapted, context);
    expect(event.actor).toBeDefined();
    expect(event.actor!.name).toBe("carol");
  });

  it("title is non-empty", () => {
    const event = transformGitHubIssue(adapted, context);
    expect(event.title).toBeTruthy();
  });
});

describe("GitHub Release: adapter → transformer round-trip", () => {
  const adapted = adaptGitHubReleaseForTransformer(
    githubListRelease as unknown as Record<string, unknown>,
    repoData as unknown as Record<string, unknown>,
  );

  it("transformer does not throw", () => {
    expect(() => transformGitHubRelease(adapted, context)).not.toThrow();
  });

  it("produces a SourceEvent with non-empty sourceId containing tag", () => {
    const event = transformGitHubRelease(adapted, context);
    expect(event.sourceId).toBeTruthy();
    expect(event.sourceId).toContain("v2.0.0");
  });

  it("source is github", () => {
    const event = transformGitHubRelease(adapted, context);
    expect(event.source).toBe("github");
  });

  it("actor is populated from release.author", () => {
    const event = transformGitHubRelease(adapted, context);
    expect(event.actor).toBeDefined();
    expect(event.actor!.name).toBe("alice");
  });

  it("references include branch ref (target_commitish)", () => {
    const event = transformGitHubRelease(adapted, context);
    const branchRefs = event.references.filter((r) => r.type === "branch");
    expect(branchRefs.length).toBeGreaterThan(0);
    expect(branchRefs[0]!.id).toBe("main");
  });
});

describe("Vercel Deployment: adapter → transformer round-trip", () => {
  const { webhookPayload, eventType } = adaptVercelDeploymentForTransformer(
    vercelListDeployment as unknown as Record<string, unknown>,
    "my-app",
  );

  it("transformer does not throw", () => {
    expect(() =>
      transformVercelDeployment(webhookPayload, eventType, context),
    ).not.toThrow();
  });

  it("produces a SourceEvent with non-empty sourceId", () => {
    const event = transformVercelDeployment(webhookPayload, eventType, context);
    expect(event.sourceId).toBeTruthy();
    expect(event.sourceId).toContain("dpl-abc123xyz");
  });

  it("source is vercel", () => {
    const event = transformVercelDeployment(webhookPayload, eventType, context);
    expect(event.source).toBe("vercel");
  });

  it("title is non-empty", () => {
    const event = transformVercelDeployment(webhookPayload, eventType, context);
    expect(event.title).toBeTruthy();
  });

  it("references include deployment and project refs", () => {
    const event = transformVercelDeployment(webhookPayload, eventType, context);
    const refTypes = event.references.map((r) => r.type);
    expect(refTypes).toContain("deployment");
    expect(refTypes).toContain("project");
  });

  it("git metadata flows through to commit/branch references", () => {
    const event = transformVercelDeployment(webhookPayload, eventType, context);
    const commitRefs = event.references.filter((r) => r.type === "commit");
    const branchRefs = event.references.filter((r) => r.type === "branch");
    expect(commitRefs.length).toBeGreaterThan(0);
    expect(commitRefs[0]!.id).toBe("abc123def456");
    expect(branchRefs.length).toBeGreaterThan(0);
    expect(branchRefs[0]!.id).toBe("main");
  });

  it("READY deployment produces succeeded sourceType", () => {
    const event = transformVercelDeployment(webhookPayload, eventType, context);
    expect(event.sourceType).toContain("succeeded");
  });

  it("ERROR deployment produces error sourceType", () => {
    const { webhookPayload: errPayload, eventType: errType } =
      adaptVercelDeploymentForTransformer(
        { ...vercelListDeployment, readyState: "ERROR" } as unknown as Record<string, unknown>,
        "my-app",
      );
    const event = transformVercelDeployment(errPayload, errType, context);
    expect(event.sourceType).toContain("error");
  });
});

/**
 * Adapter → Transformer round-trip tests
 *
 * The backfill system's core invariant: adapter output passed through the
 * real transformer must produce a valid PostTransformEvent with a non-empty sourceId.
 *
 * If a transformer starts accessing a field the list API doesn't provide
 * (e.g. pr.additions), these tests surface it immediately instead of
 * silently dropping backfilled events in production.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { BackfillContext } from "../../provider/backfill";

// Skip env validation for transitive @db/app imports
vi.hoisted(() => {
  process.env.SKIP_ENV_VALIDATION = "1";
});

import { adaptVercelDeploymentForTransformer } from "../vercel/backfill";
import { transformVercelDeployment } from "../vercel/transformers";
import {
  adaptGitHubIssueForTransformer,
  adaptGitHubPRForTransformer,
} from "./backfill";
import {
  transformGitHubIssue,
  transformGitHubPullRequest,
} from "./transformers";

// Minimal TransformContext — matches { deliveryId: string, receivedAt: number }
const context = {
  deliveryId: "backfill-roundtrip-test",
  receivedAt: Date.now(),
};

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
  user: {
    id: 1234,
    login: "alice",
    avatar_url: "https://avatars.githubusercontent.com/u/1234",
  },
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
  user: {
    id: 5678,
    login: "carol",
    avatar_url: "https://avatars.githubusercontent.com/u/5678",
  },
  updated_at: "2026-01-19T12:00:00Z",
  created_at: "2026-01-15T09:00:00Z",
  assignees: [{ login: "carol" }],
  labels: [{ name: "feature-request" }],
};

const backfillCtx: BackfillContext = {
  installationId: "install-test",
  resource: {
    providerResourceId: "12345",
    resourceName: "owner/repo",
  },
  since: "2026-01-01T00:00:00Z",
};

const vercelListDeployment = {
  uid: "dpl-abc123xyz",
  name: "my-app",
  url: "my-app-abc123.vercel.app",
  projectId: "prj-xyz",
  readyState: "READY",
  created: 1_700_000_000_000,
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
  let adapted: ReturnType<typeof adaptGitHubPRForTransformer>;

  beforeAll(() => {
    adapted = adaptGitHubPRForTransformer(
      githubListPR as unknown as Parameters<
        typeof adaptGitHubPRForTransformer
      >[0],
      backfillCtx
    );
  });

  it("transformer does not throw", () => {
    expect(() =>
      transformGitHubPullRequest(adapted, context, "")
    ).not.toThrow();
  });

  it("produces a PostTransformEvent with non-empty sourceId", () => {
    const event = transformGitHubPullRequest(adapted, context, "");
    expect(event.sourceId.length).toBeGreaterThan(0);
  });

  it("produces a PostTransformEvent with non-empty title", () => {
    const event = transformGitHubPullRequest(adapted, context, "");
    expect(event.title).toBeTruthy();
  });

  it("provider is github", () => {
    const event = transformGitHubPullRequest(adapted, context, "");
    expect(event.provider).toBe("github");
  });

  it("sourceId contains repoId and PR number", () => {
    const event = transformGitHubPullRequest(adapted, context, "");
    expect(event.sourceId).toContain("12345");
    expect(event.sourceId).toContain("42");
  });

  it("occurredAt is a valid, parseable ISO timestamp", () => {
    const event = transformGitHubPullRequest(adapted, context, "");
    const parsed = new Date(event.occurredAt);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it("merged PR produces merged eventType", () => {
    const event = transformGitHubPullRequest(adapted, context, "");
    expect(event.eventType).toContain("merged");
  });

  it("open PR produces opened eventType", () => {
    const openPR = adaptGitHubPRForTransformer(
      {
        ...githubListPR,
        state: "open",
        merged: false,
      } as unknown as Parameters<typeof adaptGitHubPRForTransformer>[0],
      backfillCtx
    );
    const event = transformGitHubPullRequest(openPR, context, "");
    expect(event.eventType).toContain("opened");
  });
});

describe("GitHub Issue: adapter → transformer round-trip", () => {
  let adapted: ReturnType<typeof adaptGitHubIssueForTransformer>;

  beforeAll(() => {
    adapted = adaptGitHubIssueForTransformer(
      githubListIssue as unknown as Parameters<
        typeof adaptGitHubIssueForTransformer
      >[0],
      backfillCtx
    );
  });

  it("transformer does not throw", () => {
    expect(() => transformGitHubIssue(adapted, context, "")).not.toThrow();
  });

  it("produces a PostTransformEvent with non-empty sourceId", () => {
    const event = transformGitHubIssue(adapted, context, "");
    expect(event.sourceId).toContain("10");
  });

  it("provider is github", () => {
    const event = transformGitHubIssue(adapted, context, "");
    expect(event.provider).toBe("github");
  });

  it("title is non-empty", () => {
    const event = transformGitHubIssue(adapted, context, "");
    expect(event.title).toBeTruthy();
  });
});

describe("Vercel Deployment: adapter → transformer round-trip", () => {
  let webhookPayload: ReturnType<
    typeof adaptVercelDeploymentForTransformer
  >["webhookPayload"];
  let eventType: ReturnType<
    typeof adaptVercelDeploymentForTransformer
  >["eventType"];

  beforeAll(() => {
    const result = adaptVercelDeploymentForTransformer(
      vercelListDeployment as Parameters<
        typeof adaptVercelDeploymentForTransformer
      >[0],
      "my-app"
    );
    webhookPayload = result.webhookPayload;
    eventType = result.eventType;
  });

  it("transformer does not throw", () => {
    expect(() =>
      transformVercelDeployment(webhookPayload, context, eventType)
    ).not.toThrow();
  });

  it("produces a PostTransformEvent with non-empty sourceId", () => {
    const event = transformVercelDeployment(webhookPayload, context, eventType);
    expect(event.sourceId).toContain("dpl-abc123xyz");
  });

  it("provider is vercel", () => {
    const event = transformVercelDeployment(webhookPayload, context, eventType);
    expect(event.provider).toBe("vercel");
  });

  it("title is non-empty", () => {
    const event = transformVercelDeployment(webhookPayload, context, eventType);
    expect(event.title).toBeTruthy();
  });

  it("entity is a deployment", () => {
    const event = transformVercelDeployment(webhookPayload, context, eventType);
    expect(event.entity.entityType).toBe("deployment");
    expect(event.entity.entityId).toBe("dpl-abc123xyz");
  });

  it("git metadata flows through to attributes", () => {
    const event = transformVercelDeployment(webhookPayload, context, eventType);
    expect(event.attributes.gitCommitSha).toBe("abc123def456");
    expect(event.attributes.gitCommitRef).toBe("main");
  });

  it("READY deployment produces succeeded eventType", () => {
    const event = transformVercelDeployment(webhookPayload, context, eventType);
    expect(event.eventType).toContain("succeeded");
  });

  it("ERROR deployment produces error eventType", () => {
    const { webhookPayload: errPayload, eventType: errType } =
      adaptVercelDeploymentForTransformer(
        {
          ...vercelListDeployment,
          readyState: "ERROR",
        } as Parameters<typeof adaptVercelDeploymentForTransformer>[0],
        "my-app"
      );
    const event = transformVercelDeployment(errPayload, context, errType);
    expect(event.eventType).toContain("error");
  });
});

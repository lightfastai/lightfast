/**
 * Dispatch unit tests.
 *
 * Covers four cases:
 *   1. Unknown category returns null (existing behavior).
 *   2. Unknown sub-action on a with-actions event returns null (new behavior).
 *   3. Known Vercel sub-action still transforms.
 *   4. REGRESSION GUARD: GitHub dispatch works even though GitHub does not
 *      define `resolveAction`. A naive uniform dot-split would drop every
 *      GitHub event because its wire eventType is the bare category
 *      ("pull_request"), not a dotted string.
 */
import { describe, expect, it, vi } from "vitest";
import type { TransformContext } from "../provider/primitives";
import { transformWebhookPayload } from "./dispatch";

const context: TransformContext = {
  deliveryId: "dispatch-test",
  receivedAt: Date.now(),
};

const validVercelPayload = {
  id: "evt_abc",
  type: "deployment.created",
  createdAt: 1_777_015_529_600,
  payload: {
    project: { id: "prj_test", name: "my-app" },
    team: { id: "team_test" },
    deployment: {
      id: "dpl_test",
      name: "my-app",
      url: "my-app.vercel.app",
      meta: {
        githubCommitSha: "abc123def456",
        githubCommitRef: "main",
        githubCommitMessage: "feat: ship it",
        githubRepo: "my-app",
        githubOrg: "my-org",
      },
    },
    target: "production",
  },
};

// Minimal GitHub PR payload that passes preTransformGitHubPullRequestEventSchema.
const validGitHubPRPayload = {
  action: "opened",
  number: 1,
  pull_request: {
    id: 1,
    number: 1,
    title: "Test PR",
    body: null,
    html_url: "https://github.com/owner/repo/pull/1",
    user: {
      login: "alice",
      id: 1,
      avatar_url: "https://avatars.githubusercontent.com/u/1",
    },
    head: { ref: "feat/x", sha: "abc123" },
    base: { ref: "main", sha: "def456" },
    state: "open",
    merged: false,
    merge_commit_sha: null,
    draft: false,
    additions: 1,
    deletions: 0,
    changed_files: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  repository: {
    id: 1,
    name: "repo",
    full_name: "owner/repo",
    html_url: "https://github.com/owner/repo",
    private: false,
    owner: { login: "owner" },
    default_branch: "main",
  },
  sender: {
    login: "alice",
    id: 1,
    avatar_url: "https://avatars.githubusercontent.com/u/1",
  },
};

describe("transformWebhookPayload", () => {
  it("returns null for unknown category", () => {
    const result = transformWebhookPayload(
      "vercel",
      "payment.charged",
      {},
      context
    );
    expect(result).toBeNull();
  });

  it("returns null for unknown sub-action on a with-actions event (Vercel)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      /* silence expected warning */
    });
    const result = transformWebhookPayload(
      "vercel",
      "deployment.promoted",
      validVercelPayload,
      context
    );
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(`eventType="deployment.promoted"`)
    );
    warn.mockRestore();
  });

  it("returns null when resolveAction returns null (compound type, Vercel)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {
      /* silence expected warning */
    });
    // Vercel's resolveAction returns null for shapes other than "category.action".
    // The dispatcher must drop those rather than fall through to schema.parse +
    // the transformer's strict enum (which would throw a ZodError).
    const result = transformWebhookPayload(
      "vercel",
      "deployment.error.retry",
      validVercelPayload,
      context
    );
    expect(result).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("unknown or missing sub-action")
    );
    warn.mockRestore();
  });

  it("still calls transform for known Vercel sub-actions", () => {
    const result = transformWebhookPayload(
      "vercel",
      "deployment.created",
      validVercelPayload,
      context
    );
    expect(result).not.toBeNull();
    expect(result?.eventType).toBe("deployment.created");
  });

  // Regression guard: GitHub does NOT define resolveAction, so the dispatcher
  // must skip the allowlist check entirely. Its wire eventType is "pull_request"
  // (no dot); a naive dot-split would drop every GitHub event.
  it("calls transform for GitHub (no resolveAction defined, check skipped)", () => {
    const result = transformWebhookPayload(
      "github",
      "pull_request",
      validGitHubPRPayload,
      context
    );
    expect(result).not.toBeNull();
    expect(result?.provider).toBe("github");
  });
});

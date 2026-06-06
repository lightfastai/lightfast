import { describe, expect, it } from "vitest";
import {
  GITHUB_BIND_ERROR_CODES,
  GITHUB_OAUTH_CALLBACK_PATH,
  GITHUB_PR_WEBHOOK_EVENTS,
  GITHUB_SETUP_PATH,
  GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH,
  GITHUB_USER_ACCOUNT_RETURN_TO_MAX_LENGTH,
  githubBindStartOutputSchema,
  githubInstallationMetadataSchema,
  githubNormalizedInstallationSchema,
  githubPrWebhookEventSchema,
  githubPrWebhookPayloadSchema,
  githubPushWebhookPayloadSchema,
  githubUserAccountBindErrorCodeSchema,
  githubUserAccountReturnToSchema,
  githubWebhookHeadersSchema,
  isGitHubUserAccountReturnTo,
  normalizeGitHubPrWebhookPayload,
  normalizeGitHubPushWebhookPayload,
  normalizeGitHubUserAccountReturnTo,
} from "../github-app";

describe("@repo/github-app-contract", () => {
  it("exports stable product callback route constants", () => {
    expect(GITHUB_SETUP_PATH).toBe("/api/github/setup");
    expect(GITHUB_OAUTH_CALLBACK_PATH).toBe("/api/github/oauth/callback");
  });

  it("exports the GitHub user account OAuth callback path", () => {
    expect(GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH).toBe(
      "/api/github/user/oauth/callback"
    );
  });

  it("accepts user account bind error codes and rejects org-only errors", () => {
    expect(
      githubUserAccountBindErrorCodeSchema.parse("missing_refresh_token")
    ).toBe("missing_refresh_token");
    expect(
      githubUserAccountBindErrorCodeSchema.parse("github_account_already_bound")
    ).toBe("github_account_already_bound");
    expect(() =>
      githubUserAccountBindErrorCodeSchema.parse("installation_not_verified")
    ).toThrow();
  });

  it("validates GitHub user account return paths in the shared contract", () => {
    expect(githubUserAccountReturnToSchema.parse("/account/settings")).toBe(
      "/account/settings"
    );
    expect(
      githubUserAccountReturnToSchema.parse(
        `/${"a".repeat(GITHUB_USER_ACCOUNT_RETURN_TO_MAX_LENGTH - 1)}`
      )
    ).toHaveLength(GITHUB_USER_ACCOUNT_RETURN_TO_MAX_LENGTH);

    for (const value of [
      "",
      "https://evil.example/path",
      "//evil.example/path",
      "/\\evil.example/path",
      "/account\\settings",
      `/${"a".repeat(GITHUB_USER_ACCOUNT_RETURN_TO_MAX_LENGTH)}`,
    ]) {
      expect(githubUserAccountReturnToSchema.safeParse(value).success).toBe(
        false
      );
      expect(isGitHubUserAccountReturnTo(value)).toBe(false);
      expect(normalizeGitHubUserAccountReturnTo(value)).toBeUndefined();
    }

    expect(normalizeGitHubUserAccountReturnTo(null)).toBeUndefined();
    expect(normalizeGitHubUserAccountReturnTo(undefined)).toBeUndefined();
  });

  it("validates client-safe start output for a GitHub App install URL", () => {
    expect(
      githubBindStartOutputSchema.parse({
        installationUrl:
          "https://github.com/apps/lightfast-local/installations/new?state=abc",
      })
    ).toEqual({
      installationUrl:
        "https://github.com/apps/lightfast-local/installations/new?state=abc",
    });
  });

  it("keeps bind error codes compact", () => {
    expect(GITHUB_BIND_ERROR_CODES).toContain("expired_state");
    expect(GITHUB_BIND_ERROR_CODES).toContain("installation_not_verified");
    expect(GITHUB_BIND_ERROR_CODES).toContain("org_already_bound");
  });

  it("normalizes organization installations only when account metadata is present", () => {
    expect(
      githubNormalizedInstallationSchema.parse({
        appId: "424242",
        appSlug: "lightfast-local",
        events: ["issues"],
        id: "1001",
        permissions: { contents: "read" },
        repositorySelection: "all",
        targetType: "Organization",
        account: {
          id: "123",
          login: "lightfast-emulated",
          type: "Organization",
        },
      })
    ).toMatchObject({
      account: { login: "lightfast-emulated" },
      id: "1001",
      targetType: "Organization",
    });
  });

  it("stores GitHub installation metadata without environment provenance", () => {
    const metadata = githubInstallationMetadataSchema.parse({
      events: ["push"],
      githubAppId: "424242",
      githubAppSlug: "lightfast-local",
      githubSetupAction: "install",
      permissions: { contents: "read" },
      repositorySelection: "all",
    });

    expect(metadata).toEqual({
      events: ["push"],
      githubAppId: "424242",
      githubAppSlug: "lightfast-local",
      githubSetupAction: "install",
      permissions: { contents: "read" },
      repositorySelection: "all",
    });
    expect(
      githubInstallationMetadataSchema.safeParse({
        ...metadata,
        verifiedBy: "github_emulator",
      }).success
    ).toBe(false);
  });

  it("does not reject unknown non-provenance installation metadata keys", () => {
    expect(
      githubInstallationMetadataSchema.safeParse({
        events: ["push"],
        githubAppId: "424242",
        githubAppSlug: "lightfast-local",
        permissions: { contents: "read" },
        repositorySelection: "all",
        source: "future_metadata",
      }).success
    ).toBe(true);
  });
});

const prInstallation = { id: 1001 };
const prRepository = {
  full_name: "lightfast-emulated/workspace",
  id: 2002,
  name: "workspace",
  owner: { login: "lightfast-emulated" },
};
const prObject = {
  id: 3003,
  number: 42,
  html_url: "https://github.example.test/lightfast-emulated/workspace/pull/42",
};

describe("GitHub webhook schemas", () => {
  it("validates webhook headers", () => {
    expect(
      githubWebhookHeadersSchema.parse({
        deliveryId: "delivery-1",
        event: "push",
        signature256: `sha256=${"a".repeat(64)}`,
      })
    ).toEqual({
      deliveryId: "delivery-1",
      event: "push",
      signature256: `sha256=${"a".repeat(64)}`,
    });
  });

  it("rejects missing, empty, or malformed required webhook headers", () => {
    expect(
      githubWebhookHeadersSchema.safeParse({
        deliveryId: "delivery-1",
        event: "push",
      }).success
    ).toBe(false);
    expect(
      githubWebhookHeadersSchema.safeParse({
        deliveryId: "",
        event: "push",
        signature256: `sha256=${"a".repeat(64)}`,
      }).success
    ).toBe(false);
    expect(
      githubWebhookHeadersSchema.safeParse({
        deliveryId: "delivery-1",
        event: "push",
        signature256: "sha256=abc",
      }).success
    ).toBe(false);
    expect(
      githubWebhookHeadersSchema.safeParse({
        deliveryId: "delivery-1",
        event: "push",
        signature256: `sha1=${"a".repeat(40)}`,
      }).success
    ).toBe(false);
  });

  it("defines GitHub PR webhook event families", () => {
    expect(GITHUB_PR_WEBHOOK_EVENTS).toEqual([
      "pull_request",
      "pull_request_review",
      "pull_request_review_comment",
      "pull_request_review_thread",
      "issue_comment",
    ]);
    expect(githubPrWebhookEventSchema.parse("pull_request_review")).toBe(
      "pull_request_review"
    );
    expect(githubPrWebhookEventSchema.safeParse("push").success).toBe(false);
  });

  it("normalizes pull_request webhook routing fields", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "synchronize",
      installation: prInstallation,
      pull_request: prObject,
      repository: prRepository,
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "pull_request",
        payload,
      })
    ).toEqual({
      action: "synchronize",
      event: "pull_request",
      providerInstallationId: "1001",
      providerPullRequestId: "3003",
      providerRepositoryId: "2002",
      pullRequestNumber: 42,
    });
  });

  it("normalizes pull_request_review webhook routing fields", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "submitted",
      installation: prInstallation,
      pull_request: prObject,
      repository: prRepository,
      review: { id: 4004, state: "approved" },
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "pull_request_review",
        payload,
      })
    ).toMatchObject({
      action: "submitted",
      event: "pull_request_review",
      providerPullRequestId: "3003",
      pullRequestNumber: 42,
    });
  });

  it("normalizes review comment payloads without requiring a PR id", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "created",
      comment: {
        id: 5005,
        pull_request_url:
          "https://api.github.example.test/repos/lightfast-emulated/workspace/pulls/42",
      },
      installation: prInstallation,
      repository: prRepository,
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "pull_request_review_comment",
        payload,
      })
    ).toEqual({
      action: "created",
      event: "pull_request_review_comment",
      providerInstallationId: "1001",
      providerPullRequestId: null,
      providerRepositoryId: "2002",
      pullRequestNumber: 42,
    });
  });

  it("normalizes review thread payloads from the pull_request object", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "resolved",
      installation: prInstallation,
      pull_request: prObject,
      repository: prRepository,
      thread: { id: 6006 },
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "pull_request_review_thread",
        payload,
      })
    ).toMatchObject({
      action: "resolved",
      event: "pull_request_review_thread",
      providerPullRequestId: "3003",
      pullRequestNumber: 42,
    });
  });

  it("normalizes PR-attached issue comments and leaves PR id nullable", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "edited",
      comment: { id: 7007, body: "Updated" },
      installation: prInstallation,
      issue: {
        number: 42,
        pull_request: {
          url: "https://api.github.example.test/repos/lightfast-emulated/workspace/pulls/42",
        },
      },
      repository: prRepository,
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "issue_comment",
        payload,
      })
    ).toEqual({
      action: "edited",
      event: "issue_comment",
      providerInstallationId: "1001",
      providerPullRequestId: null,
      providerRepositoryId: "2002",
      pullRequestNumber: 42,
    });
  });

  it("returns null for issue comments that are not attached to PRs", () => {
    const payload = githubPrWebhookPayloadSchema.parse({
      action: "created",
      comment: { id: 7007, body: "Issue comment" },
      installation: prInstallation,
      issue: { number: 42 },
      repository: prRepository,
    });

    expect(
      normalizeGitHubPrWebhookPayload({
        event: "issue_comment",
        payload,
      })
    ).toBeNull();
  });

  it("rejects PR-family payloads without a pull request number", () => {
    expect(() =>
      normalizeGitHubPrWebhookPayload({
        event: "pull_request",
        payload: githubPrWebhookPayloadSchema.parse({
          action: "opened",
          installation: prInstallation,
          pull_request: { id: 3003 },
          repository: prRepository,
        }),
      })
    ).toThrow(/pull request number/i);
  });

  it("normalizes push payload routing fields", () => {
    const payload = githubPushWebhookPayloadSchema.parse({
      after: "a".repeat(40),
      before: "b".repeat(40),
      commits: [
        {
          added: ["skills/demo/SKILL.md"],
          modified: ["README.md"],
          removed: ["docs/old.md"],
        },
      ],
      size: 1,
      installation: { id: 1001 },
      ref: "refs/heads/main",
      repository: {
        full_name: "lightfast-emulated/workspace",
        id: 2002,
        name: "workspace",
        owner: { login: "lightfast-emulated" },
      },
    });

    expect(normalizeGitHubPushWebhookPayload(payload)).toEqual({
      afterSha: "a".repeat(40),
      beforeSha: "b".repeat(40),
      changedPathsComplete: true,
      changedPaths: ["skills/demo/SKILL.md", "README.md", "docs/old.md"],
      providerInstallationId: "1001",
      providerRepositoryId: "2002",
      ref: "refs/heads/main",
      repositoryFullName: "lightfast-emulated/workspace",
    });
  });

  it("marks changed paths incomplete when the push payload omits commits", () => {
    const payload = githubPushWebhookPayloadSchema.parse({
      after: "a".repeat(40),
      before: "b".repeat(40),
      commits: [
        {
          added: [],
          modified: ["docs/readme.md"],
          removed: [],
        },
      ],
      size: 2,
      installation: { id: 1001 },
      ref: "refs/heads/main",
      repository: {
        full_name: "lightfast-emulated/workspace",
        id: 2002,
        name: "workspace",
        owner: { login: "lightfast-emulated" },
      },
    });

    expect(normalizeGitHubPushWebhookPayload(payload)).toMatchObject({
      changedPaths: ["docs/readme.md"],
      changedPathsComplete: false,
    });
  });

  it("rejects negative numeric installation ids in push payloads", () => {
    expect(
      githubPushWebhookPayloadSchema.safeParse({
        after: "a".repeat(40),
        before: "b".repeat(40),
        installation: { id: -1 },
        ref: "refs/heads/main",
        repository: {
          full_name: "lightfast-emulated/workspace",
          id: 2002,
          name: "workspace",
          owner: { login: "lightfast-emulated" },
        },
      }).success
    ).toBe(false);
  });

  it("rejects fractional numeric repository ids in push payloads", () => {
    expect(
      githubPushWebhookPayloadSchema.safeParse({
        after: "a".repeat(40),
        before: "b".repeat(40),
        installation: { id: 1001 },
        ref: "refs/heads/main",
        repository: {
          full_name: "lightfast-emulated/workspace",
          id: 2002.5,
          name: "workspace",
          owner: { login: "lightfast-emulated" },
        },
      }).success
    ).toBe(false);
  });

  it("rejects malformed push SHA and repository full-name fields", () => {
    const valid = {
      after: "a".repeat(40),
      before: "b".repeat(40),
      installation: { id: 1001 },
      ref: "refs/heads/main",
      repository: {
        full_name: "lightfast-emulated/workspace",
        id: 2002,
        name: "workspace",
        owner: { login: "lightfast-emulated" },
      },
    };

    expect(
      githubPushWebhookPayloadSchema.safeParse({
        ...valid,
        after: "not-a-sha",
      }).success
    ).toBe(false);
    expect(
      githubPushWebhookPayloadSchema.safeParse({
        ...valid,
        before: "g".repeat(40),
      }).success
    ).toBe(false);
    expect(
      githubPushWebhookPayloadSchema.safeParse({
        ...valid,
        repository: {
          ...valid.repository,
          full_name: "group/subgroup/workspace",
        },
      }).success
    ).toBe(false);
  });
});

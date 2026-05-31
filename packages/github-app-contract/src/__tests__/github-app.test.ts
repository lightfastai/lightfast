import { describe, expect, it } from "vitest";
import {
  GITHUB_BIND_ERROR_CODES,
  GITHUB_OAUTH_CALLBACK_PATH,
  GITHUB_SETUP_PATH,
  GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH,
  GITHUB_USER_ACCOUNT_RETURN_TO_MAX_LENGTH,
  githubBindStartOutputSchema,
  githubInstallationMetadataSchema,
  githubNormalizedInstallationSchema,
  githubPushWebhookPayloadSchema,
  githubUserAccountBindErrorCodeSchema,
  githubUserAccountReturnToSchema,
  githubWebhookHeadersSchema,
  isGitHubUserAccountReturnTo,
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
      changedPaths: ["skills/demo/SKILL.md", "README.md", "docs/old.md"],
      providerInstallationId: "1001",
      providerRepositoryId: "2002",
      ref: "refs/heads/main",
      repositoryFullName: "lightfast-emulated/workspace",
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

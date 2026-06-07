import { describe, expect, it } from "vitest";
import {
  matchesAnyWatchedPath,
  matchesWatchedPath,
  normalizeWatchedWebhookEvents,
  SOURCE_CONTROL_ALL_PATHS_GLOB,
  SOURCE_CONTROL_PR_WEBHOOK_EVENTS,
  SOURCE_CONTROL_REPOSITORY_SYNC_STATUSES,
  SOURCE_CONTROL_WEBHOOK_DELIVERY_STATUSES,
  sourceControlPrWebhookEventSchema,
  sourceControlRepositoryPushEventSchema,
  sourceControlRepositorySyncStatusSchema,
  splitRepositoryFullName,
  watchedPathGlobsSchema,
  watchedWebhookEventsSchema,
  watchesWebhookEvent,
} from "../index";

describe("@repo/source-control-contract", () => {
  it("defines the minimal webhook delivery statuses", () => {
    expect(SOURCE_CONTROL_WEBHOOK_DELIVERY_STATUSES).toEqual([
      "received",
      "ignored",
      "queued",
      "processed",
      "failed",
    ]);
  });

  it("defines repository sync statuses", () => {
    expect(SOURCE_CONTROL_REPOSITORY_SYNC_STATUSES).toEqual([
      "enabled",
      "disabled",
    ]);
    expect(sourceControlRepositorySyncStatusSchema.parse("enabled")).toBe(
      "enabled"
    );
    expect(sourceControlRepositorySyncStatusSchema.parse("disabled")).toBe(
      "disabled"
    );
  });

  it("defines PR webhook event families", () => {
    expect(SOURCE_CONTROL_PR_WEBHOOK_EVENTS).toEqual([
      "pull_request",
      "pull_request_review",
      "pull_request_review_comment",
      "pull_request_review_thread",
      "issue_comment",
    ]);
    expect(sourceControlPrWebhookEventSchema.parse("pull_request")).toBe(
      "pull_request"
    );
    expect(
      sourceControlPrWebhookEventSchema.parse("pull_request_review_thread")
    ).toBe("pull_request_review_thread");
    expect(sourceControlPrWebhookEventSchema.safeParse("push").success).toBe(
      false
    );
  });

  it("validates watched webhook event lists with empty default support", () => {
    expect(watchedWebhookEventsSchema.parse([])).toEqual([]);
    expect(
      watchedWebhookEventsSchema.parse([
        "pull_request",
        "pull_request_review_comment",
      ])
    ).toEqual(["pull_request", "pull_request_review_comment"]);
    expect(watchedWebhookEventsSchema.safeParse(["push"]).success).toBe(false);
  });

  it("normalizes nullable watched webhook events", () => {
    expect(normalizeWatchedWebhookEvents(null)).toEqual([]);
    expect(normalizeWatchedWebhookEvents(undefined)).toEqual([]);
    expect(
      normalizeWatchedWebhookEvents(["pull_request", "issue_comment"])
    ).toEqual(["pull_request", "issue_comment"]);
  });

  it("checks whether a repository watches a webhook event family", () => {
    expect(watchesWebhookEvent(["pull_request"], "pull_request")).toBe(true);
    expect(watchesWebhookEvent(["pull_request"], "issue_comment")).toBe(false);
    expect(watchesWebhookEvent(null, "pull_request")).toBe(false);
    expect(watchesWebhookEvent([], "push")).toBe(false);
  });

  it("validates watched path globs as supported non-empty patterns", () => {
    expect(watchedPathGlobsSchema.parse(["skills/**", "README.md"])).toEqual([
      "skills/**",
      "README.md",
    ]);
    expect(watchedPathGlobsSchema.safeParse([]).success).toBe(false);
    expect(watchedPathGlobsSchema.safeParse([""]).success).toBe(false);
  });

  it("exports and validates the all-paths watch glob", () => {
    expect(SOURCE_CONTROL_ALL_PATHS_GLOB).toBe("**");
    expect(
      watchedPathGlobsSchema.parse([SOURCE_CONTROL_ALL_PATHS_GLOB])
    ).toEqual(["**"]);
  });

  it("rejects unsupported watched path wildcard patterns", () => {
    for (const pattern of [
      "*.md",
      "docs/*.md",
      "**/*.ts",
      "skills/**/SKILL.md",
      "/**",
    ]) {
      expect(watchedPathGlobsSchema.safeParse([pattern]).success).toBe(false);
    }
  });

  it("splits repository full names", () => {
    expect(splitRepositoryFullName("lightfast-emulated/workspace")).toEqual({
      owner: "lightfast-emulated",
      repo: "workspace",
    });
    expect(() => splitRepositoryFullName("workspace")).toThrow(
      /Invalid repository full name/
    );
    expect(() => splitRepositoryFullName("group/subgroup/repo")).toThrow(
      /Invalid repository full name/
    );
  });

  it("matches exact paths and prefix globs", () => {
    expect(matchesWatchedPath("README.md", ["README.md"])).toBe(true);
    expect(matchesWatchedPath("skills/foo/SKILL.md", ["skills/**"])).toBe(true);
    expect(matchesWatchedPath("docs/SKILL.md", ["skills/**"])).toBe(false);
  });

  it("matches all non-empty changed paths with the all-paths watch glob", () => {
    expect(matchesWatchedPath("README.md", ["**"])).toBe(true);
    expect(matchesWatchedPath("src/app.ts", ["**"])).toBe(true);
    expect(matchesWatchedPath("", ["**"])).toBe(false);
    expect(matchesAnyWatchedPath(["docs/readme.md"], ["**"])).toBe(true);
    expect(matchesAnyWatchedPath([], ["**"])).toBe(false);
  });

  it("matches watched globs against a changed path set", () => {
    expect(
      matchesAnyWatchedPath(
        ["docs/readme.md", "skills/foo/SKILL.md"],
        ["skills/**"]
      )
    ).toBe(true);
    expect(matchesAnyWatchedPath(["docs/readme.md"], ["skills/**"])).toBe(
      false
    );
    expect(matchesAnyWatchedPath([], ["skills/**"])).toBe(false);
  });

  it("validates repository push event payloads", () => {
    expect(
      sourceControlRepositoryPushEventSchema.parse({
        afterSha: "a".repeat(40),
        beforeSha: "b".repeat(40),
        changedPaths: ["skills/demo/SKILL.md"],
        changedPathsComplete: true,
        deliveryId: "delivery-1",
        orgSourceControlBindingId: 1,
        providerInstallationId: "1001",
        providerRepositoryId: "2002",
        ref: "refs/heads/main",
        repositoryFullName: "lightfast-emulated/workspace",
        repositoryWatchId: 10,
      })
    ).toMatchObject({
      changedPathsComplete: true,
      deliveryId: "delivery-1",
      repositoryFullName: "lightfast-emulated/workspace",
    });
  });

  it("accepts legacy repository push payloads without changed path completeness", () => {
    const parsed = sourceControlRepositoryPushEventSchema.parse({
      afterSha: "a".repeat(40),
      beforeSha: "b".repeat(40),
      changedPaths: ["skills/demo/SKILL.md"],
      deliveryId: "delivery-1",
      orgSourceControlBindingId: 1,
      providerInstallationId: "1001",
      providerRepositoryId: "2002",
      ref: "refs/heads/main",
      repositoryFullName: "lightfast-emulated/workspace",
      repositoryWatchId: 10,
    });

    expect(parsed.changedPathsComplete).toBeUndefined();
    expect(parsed.deliveryId).toBe("delivery-1");
  });

  it("rejects malformed repository push routing fields", () => {
    const valid = {
      afterSha: "a".repeat(40),
      beforeSha: "b".repeat(40),
      deliveryId: "delivery-1",
      changedPaths: ["skills/demo/SKILL.md"],
      changedPathsComplete: true,
      orgSourceControlBindingId: 1,
      providerInstallationId: "1001",
      providerRepositoryId: "2002",
      ref: "refs/heads/main",
      repositoryFullName: "lightfast-emulated/workspace",
      repositoryWatchId: 10,
    };

    expect(
      sourceControlRepositoryPushEventSchema.safeParse({
        ...valid,
        afterSha: "not-a-sha",
      }).success
    ).toBe(false);
    expect(
      sourceControlRepositoryPushEventSchema.safeParse({
        ...valid,
        beforeSha: "g".repeat(40),
      }).success
    ).toBe(false);
    expect(
      sourceControlRepositoryPushEventSchema.safeParse({
        ...valid,
        repositoryFullName: "group/subgroup/workspace",
      }).success
    ).toBe(false);
  });
});

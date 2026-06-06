import type { Database } from "@db/app";
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const {
  getSkillIndexSnapshotMock,
  getVerifiedLightfastSkillSourceRepositoryIdMock,
  requestSkillIndexRefreshMock,
} = vi.hoisted(() => ({
  getSkillIndexSnapshotMock: vi.fn(),
  getVerifiedLightfastSkillSourceRepositoryIdMock: vi.fn(),
  requestSkillIndexRefreshMock: vi.fn(),
}));

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("../services/skills", () => ({
  getSkillIndexSnapshot: getSkillIndexSnapshotMock,
  getVerifiedLightfastSkillSourceRepositoryId:
    getVerifiedLightfastSkillSourceRepositoryIdMock,
  requestSkillIndexRefresh: requestSkillIndexRefreshMock,
}));
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));
vi.mock("@vendor/observability/log/next", () => ({
  log: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { workspaceSkillsRouter } = await import(
  "../router/(pending-not-allowed)/workspace-skills"
);

const testRouter = createTRPCRouter({ skills: workspaceSkillsRouter });
const createCaller = createCallerFactory(testRouter);

type ActiveAuthIdentity = Extract<AuthIdentity, { type: "active" }>;

const activeIdentity: ActiveAuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

const pendingIdentity: AuthIdentity = {
  type: "pending",
  userId: "user_test",
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

const codeReviewSkill = {
  slug: "code-review",
  name: "code-review",
  description: "Use when reviewing code.",
  validationStatus: "valid",
  path: "skills/code-review/SKILL.md",
  diagnostics: [],
  resources: { assets: [], references: [], scripts: [], truncated: false },
};

const brokenSkill = {
  slug: "broken-skill",
  name: "broken-skill",
  description: "Invalid skill fixture.",
  validationStatus: "invalid",
  path: "skills/broken-skill/SKILL.md",
  diagnostics: [{ code: "invalid", message: "Invalid skill." }],
  resources: { assets: [], references: [], scripts: [], truncated: false },
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  getVerifiedLightfastSkillSourceRepositoryIdMock.mockReset();
  getVerifiedLightfastSkillSourceRepositoryIdMock.mockResolvedValue(42);
  getSkillIndexSnapshotMock.mockReset();
  getSkillIndexSnapshotMock.mockResolvedValue({
    freshness: {
      checkedAt: new Date("2026-06-01T00:00:00.000Z"),
      errorCode: null,
      errorMessage: null,
      githubCommitSha: "b".repeat(40),
      indexedAt: new Date("2026-06-01T00:00:00.000Z"),
      indexedCommitSha: "b".repeat(40),
      status: "fresh",
    },
    indexDiagnostics: [],
    repositoryUrl: "https://github.com/acme/.lightfast",
    skills: [brokenSkill, codeReviewSkill],
    snapshotVersion: "100:1780272000000:bbbb:fresh",
  });
  requestSkillIndexRefreshMock.mockReset();
  requestSkillIndexRefreshMock.mockResolvedValue({
    enqueued: true,
    sourceControlRepositoryId: 42,
  });
});

describe("workspaceSkillsRouter.list", () => {
  it("lists skills through the snapshot service", async () => {
    await expect(caller().skills.list(undefined)).resolves.toMatchObject({
      repositoryUrl: "https://github.com/acme/.lightfast",
      skills: [brokenSkill, codeReviewSkill],
    });

    expect(
      getVerifiedLightfastSkillSourceRepositoryIdMock
    ).toHaveBeenCalledWith(expect.anything(), { clerkOrgId: "org_test" });
    expect(getSkillIndexSnapshotMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      sourceControlRepositoryId: 42,
    });
  });

  it("filters by validation status after reading a snapshot", async () => {
    await expect(
      caller().skills.list({ validationStatus: "invalid" })
    ).resolves.toMatchObject({
      skills: [brokenSkill],
    });

    expect(getSkillIndexSnapshotMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      sourceControlRepositoryId: 42,
    });
  });

  it("rejects invalid validation status inputs before querying", async () => {
    await expect(
      caller().skills.list({ validationStatus: "broken" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(getSkillIndexSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects callers without a bound organization", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      }).skills.list(undefined)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getSkillIndexSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects wrong-org repository access before reading the skill index", async () => {
    getVerifiedLightfastSkillSourceRepositoryIdMock.mockRejectedValueOnce(
      new TRPCError({
        code: "FORBIDDEN",
        message: "Repository is not available to this organization.",
      })
    );

    await expect(
      caller({
        ...activeIdentity,
        orgId: "org_other",
      }).skills.list(undefined)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(
      getVerifiedLightfastSkillSourceRepositoryIdMock
    ).toHaveBeenCalledWith(expect.anything(), { clerkOrgId: "org_other" });
    expect(getSkillIndexSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects when no active org is selected", async () => {
    await expect(
      caller(pendingIdentity).skills.list(undefined)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(getSkillIndexSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      caller(unauthenticatedIdentity).skills.list(undefined)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(getSkillIndexSnapshotMock).not.toHaveBeenCalled();
  });

  it("rejects expired-token callers as unauthenticated before querying", async () => {
    await expect(
      caller({ type: "unauthenticated" }).skills.get({ slug: "code-review" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(
      getVerifiedLightfastSkillSourceRepositoryIdMock
    ).not.toHaveBeenCalled();
    expect(getSkillIndexSnapshotMock).not.toHaveBeenCalled();
  });
});

describe("workspaceSkillsRouter.get", () => {
  it("returns one skill from the snapshot service", async () => {
    await expect(
      caller().skills.get({ slug: "code-review" })
    ).resolves.toMatchObject({
      repositoryUrl: "https://github.com/acme/.lightfast",
      skill: codeReviewSkill,
    });

    expect(getSkillIndexSnapshotMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      slug: "code-review",
      sourceControlRepositoryId: 42,
    });
  });

  it("throws NOT_FOUND when the skill is absent after refresh", async () => {
    await expect(
      caller().skills.get({ slug: "missing-skill" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("validates skill slugs before querying", async () => {
    await expect(
      caller().skills.get({ slug: "bad_slug" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(getSkillIndexSnapshotMock).not.toHaveBeenCalled();
  });
});

describe("workspaceSkillsRouter.requestRefresh", () => {
  it("rejects unauthenticated callers before enqueue", async () => {
    await expect(
      caller(unauthenticatedIdentity).skills.requestRefresh(undefined)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(
      getVerifiedLightfastSkillSourceRepositoryIdMock
    ).not.toHaveBeenCalled();
    expect(requestSkillIndexRefreshMock).not.toHaveBeenCalled();
  });

  it("rejects callers without a bound organization before enqueue", async () => {
    await expect(
      caller({
        ...activeIdentity,
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
      }).skills.requestRefresh(undefined)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(
      getVerifiedLightfastSkillSourceRepositoryIdMock
    ).not.toHaveBeenCalled();
    expect(requestSkillIndexRefreshMock).not.toHaveBeenCalled();
  });

  it("rejects callers without an active org before enqueue", async () => {
    await expect(
      caller(pendingIdentity).skills.requestRefresh(undefined)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(
      getVerifiedLightfastSkillSourceRepositoryIdMock
    ).not.toHaveBeenCalled();
    expect(requestSkillIndexRefreshMock).not.toHaveBeenCalled();
  });

  it("rejects wrong-org repository access before enqueue", async () => {
    getVerifiedLightfastSkillSourceRepositoryIdMock.mockRejectedValueOnce(
      new TRPCError({
        code: "FORBIDDEN",
        message: "Repository is not available to this organization.",
      })
    );

    await expect(
      caller({ ...activeIdentity, orgId: "org_other" }).skills.requestRefresh(
        undefined
      )
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(
      getVerifiedLightfastSkillSourceRepositoryIdMock
    ).toHaveBeenCalledWith(expect.anything(), { clerkOrgId: "org_other" });
    expect(requestSkillIndexRefreshMock).not.toHaveBeenCalled();
  });

  it("queues a refresh for the active org skill source", async () => {
    await expect(caller().skills.requestRefresh(undefined)).resolves.toEqual({
      enqueued: true,
    });

    expect(
      getVerifiedLightfastSkillSourceRepositoryIdMock
    ).toHaveBeenCalledWith(expect.anything(), { clerkOrgId: "org_test" });
    expect(requestSkillIndexRefreshMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      reason: "read",
      sourceControlRepositoryId: 42,
    });
  });

  it("rejects supplied input fields", async () => {
    await expect(
      caller().skills.requestRefresh({ sourceControlRepositoryId: 42 } as never)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(requestSkillIndexRefreshMock).not.toHaveBeenCalled();
  });
});

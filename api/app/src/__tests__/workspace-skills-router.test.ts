import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const {
  ensureFreshSkillIndexForReadMock,
  getVerifiedLightfastSkillSourceRepositoryIdMock,
} = vi.hoisted(() => ({
  ensureFreshSkillIndexForReadMock: vi.fn(),
  getVerifiedLightfastSkillSourceRepositoryIdMock: vi.fn(),
}));

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("../services/skills", () => ({
  ensureFreshSkillIndexForRead: ensureFreshSkillIndexForReadMock,
  getVerifiedLightfastSkillSourceRepositoryId:
    getVerifiedLightfastSkillSourceRepositoryIdMock,
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
  ensureFreshSkillIndexForReadMock.mockReset();
  ensureFreshSkillIndexForReadMock.mockResolvedValue({
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
  });
});

describe("workspaceSkillsRouter.list", () => {
  it("lists skills through the read-time freshness service", async () => {
    await expect(caller().skills.list(undefined)).resolves.toMatchObject({
      repositoryUrl: "https://github.com/acme/.lightfast",
      skills: [brokenSkill, codeReviewSkill],
    });

    expect(getVerifiedLightfastSkillSourceRepositoryIdMock).toHaveBeenCalledWith(
      expect.anything(),
      { clerkOrgId: "org_test" }
    );
    expect(ensureFreshSkillIndexForReadMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      sourceControlRepositoryId: 42,
    });
  });

  it("filters by validation status after forcing read-time freshness", async () => {
    await expect(
      caller().skills.list({ validationStatus: "invalid" })
    ).resolves.toMatchObject({
      skills: [brokenSkill],
    });

    expect(ensureFreshSkillIndexForReadMock).toHaveBeenCalledWith({
      clerkOrgId: "org_test",
      sourceControlRepositoryId: 42,
    });
  });

  it("rejects invalid validation status inputs before querying", async () => {
    await expect(
      caller().skills.list({ validationStatus: "broken" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    expect(ensureFreshSkillIndexForReadMock).not.toHaveBeenCalled();
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
    expect(ensureFreshSkillIndexForReadMock).not.toHaveBeenCalled();
  });

  it("rejects when no active org is selected", async () => {
    await expect(
      caller(pendingIdentity).skills.list(undefined)
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(ensureFreshSkillIndexForReadMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      caller(unauthenticatedIdentity).skills.list(undefined)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(ensureFreshSkillIndexForReadMock).not.toHaveBeenCalled();
  });
});

describe("workspaceSkillsRouter.get", () => {
  it("returns one skill from the read-time freshness service", async () => {
    await expect(
      caller().skills.get({ slug: "code-review" })
    ).resolves.toMatchObject({
      repositoryUrl: "https://github.com/acme/.lightfast",
      skill: codeReviewSkill,
    });

    expect(ensureFreshSkillIndexForReadMock).toHaveBeenCalledWith({
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

    expect(ensureFreshSkillIndexForReadMock).not.toHaveBeenCalled();
  });
});

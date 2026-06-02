import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";

const getIdentityIndexStateBySourceControlRepositoryIdMock = vi.fn();
const listIdentityIndexFilesMock = vi.fn();
const listIdentityIndexRefreshCandidatesMock = vi.fn();
const sendMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));
vi.mock("@db/app", () => ({
  getIdentityIndexStateBySourceControlRepositoryId:
    getIdentityIndexStateBySourceControlRepositoryIdMock,
  listIdentityIndexFiles: listIdentityIndexFilesMock,
  listIdentityIndexRefreshCandidates: listIdentityIndexRefreshCandidatesMock,
}));
vi.mock("../inngest/client", () => ({
  inngest: { send: sendMock },
}));
vi.mock("@vendor/clerk/env", () => ({
  clerkEnvBase: { CLERK_SECRET_KEY: "sk_test_fake-secret-key-for-tests" },
}));
vi.mock("@vendor/observability/trpc", () => ({
  createObservabilityMiddleware:
    () =>
    ({ next }: { next: () => unknown }) =>
      next(),
}));

const { createCallerFactory, createTRPCRouter } = await import("../trpc");
const { orgIdentityRouter } = await import(
  "../router/(pending-not-allowed)/org-identity"
);

const testRouter = createTRPCRouter({
  org: createTRPCRouter({
    settings: createTRPCRouter({
      identity: orgIdentityRouter,
    }),
  }),
});
const createCaller = createCallerFactory(testRouter);

const now = new Date("2026-06-01T00:00:00.000Z");

const activeIdentity: AuthIdentity = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
};

const unboundIdentity: AuthIdentity = {
  ...activeIdentity,
  orgGate: { bindingStatus: "unbound", nextSetupRequirement: "github_org" },
};

const unauthenticatedIdentity: AuthIdentity = {
  type: "unauthenticated",
};

function caller(identity: AuthIdentity = activeIdentity) {
  return createCaller({
    auth: { identity },
    db: {} as Database,
    headers: new Headers(),
  });
}

beforeEach(() => {
  getIdentityIndexStateBySourceControlRepositoryIdMock.mockReset();
  listIdentityIndexFilesMock.mockReset();
  listIdentityIndexRefreshCandidatesMock.mockReset();
  sendMock.mockReset();

  listIdentityIndexRefreshCandidatesMock.mockResolvedValue([candidate()]);
  listIdentityIndexFilesMock.mockResolvedValue([
    file({
      kind: "identity",
      path: "IDENTITY.md",
      sourceMarkdown: "# Acme",
      status: "present",
    }),
    file({
      kind: "soul",
      path: "SOUL.md",
      sourceMarkdown: null,
      status: "missing",
    }),
  ]);
  sendMock.mockResolvedValue({ ids: ["event_1"] });
});

describe("org.settings.identity.get", () => {
  it("returns indexed Identity and Soul settings rows for a bound org", async () => {
    await expect(caller().org.settings.identity.get()).resolves.toMatchObject({
      repository: {
        defaultBranch: "main",
        id: "1",
        name: ".lightfast",
        owner: "acme",
      },
      state: {
        diagnostics: [],
        indexedCommitSha: "commit-main",
        indexedTreeSha: "tree-sha",
        status: "fresh",
      },
      files: [
        {
          githubUrl: "https://github.com/acme/.lightfast/blob/main/IDENTITY.md",
          kind: "identity",
          label: "Identity",
          path: "IDENTITY.md",
          sourceMarkdown: "# Acme",
          status: "present",
        },
        {
          githubUrl: "https://github.com/acme/.lightfast/blob/main/SOUL.md",
          kind: "soul",
          label: "Soul",
          path: "SOUL.md",
          sourceMarkdown: null,
          status: "missing",
        },
      ],
    });

    expect(listIdentityIndexRefreshCandidatesMock).toHaveBeenCalledWith(
      expect.anything(),
      { clerkOrgId: "org_test", limit: 100 }
    );
    expect(listIdentityIndexFilesMock).toHaveBeenCalledWith(expect.anything(), {
      stateId: 100,
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns default missing file rows and enqueues refresh when no index exists", async () => {
    listIdentityIndexRefreshCandidatesMock.mockResolvedValueOnce([
      candidate(null),
    ]);
    getIdentityIndexStateBySourceControlRepositoryIdMock.mockResolvedValueOnce(
      null
    );

    const result = await caller().org.settings.identity.get();

    expect(result.state.status).toBe("never");
    expect(result.files).toEqual([
      expect.objectContaining({ kind: "identity", status: "missing" }),
      expect.objectContaining({ kind: "soul", status: "missing" }),
    ]);
    expect(sendMock).toHaveBeenCalledWith({
      name: "app/identity.index.refresh.requested",
      data: {
        dedupeKey: "1-read",
        reason: "read",
        sourceControlRepositoryId: 1,
      },
    });
  });

  it("rejects callers without a bound organization", async () => {
    await expect(
      caller(unboundIdentity).org.settings.identity.get()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(listIdentityIndexRefreshCandidatesMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated callers", async () => {
    await expect(
      caller(unauthenticatedIdentity).org.settings.identity.get()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(listIdentityIndexRefreshCandidatesMock).not.toHaveBeenCalled();
  });
});

function state(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: now,
    githubRefEtag: "etag",
    id: 100,
    indexDiagnostics: [],
    indexedAt: now,
    indexedCommitSha: "commit-main",
    indexedTreeSha: "tree-sha",
    lastCheckedAt: now,
    lastCheckedCommitSha: "commit-main",
    lastRefreshErrorCode: null,
    lastRefreshErrorMessage: null,
    lastRefreshFailedAt: null,
    lastRefreshStatus: "fresh",
    lastRefreshSucceededAt: now,
    missingFileCount: 1,
    presentFileCount: 1,
    readErrorFileCount: 0,
    refreshLockedUntil: null,
    refreshLockToken: null,
    sourceControlRepositoryId: 1,
    tooLargeFileCount: 0,
    updatedAt: now,
    ...overrides,
  };
}

function candidate(indexState: ReturnType<typeof state> | null = state()) {
  const repository = {
    createdAt: now,
    fullName: "acme/.lightfast",
    id: 1,
    orgSourceControlBindingId: 1,
    providerRepositoryId: "repo_1",
    updatedAt: now,
    watchedPathGlobs: ["skills/**", "IDENTITY.md", "SOUL.md"],
  };
  return {
    binding: {
      clerkOrgId: "org_test",
      connectedAt: now,
      connectedByUserId: "user_test",
      createdAt: now,
      id: 1,
      metadata: {
        lightfastRepository: {
          fullName: repository.fullName,
          id: repository.providerRepositoryId,
          installationId: "installation_1",
          name: ".lightfast",
          verifiedAt: "2026-06-01T00:00:00.000Z",
        },
      },
      provider: "github",
      providerAccountId: "account_1",
      providerAccountLogin: "acme",
      providerInstallationId: "installation_1",
      revokedAt: null,
      status: "active",
      updatedAt: now,
    },
    repository,
    state: indexState,
  };
}

function file(overrides: Record<string, unknown> = {}) {
  return {
    contentHash: "sha256:abc",
    contentSha: "content-sha",
    contentSize: 20,
    createdAt: now,
    diagnostics: [],
    id: 1,
    identityIndexStateId: 100,
    indexedCommitSha: "commit-main",
    kind: "identity",
    path: "IDENTITY.md",
    sourceMarkdown: "# Acme",
    status: "present",
    updatedAt: now,
    ...overrides,
  };
}

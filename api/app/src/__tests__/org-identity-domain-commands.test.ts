import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecutionContext } from "../domain";
import { getOrgIdentityCommand } from "../domain/org-identity";

const indexedAt = new Date("2026-06-16T01:02:03.000Z");

const activeCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
    orgId: "org_acme",
    source: "web",
    userId: "user_test",
  },
};

const pendingCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    source: "web",
    userId: "user_test",
  },
};

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    binding: {
      providerInstallationId: "installation_123",
    },
    repository: {
      fullName: "acme/.lightfast",
      id: 42,
    },
    state: {
      id: 7,
      indexDiagnostics: [],
      indexedCommitSha: "abcdef123456",
      indexedTreeSha: "tree123",
      lastCheckedAt: indexedAt,
      lastFailureAt: null,
      lastRefreshFailedAt: null,
      lastRefreshStatus: "succeeded",
      lastRefreshSucceededAt: indexedAt,
    },
    ...overrides,
  };
}

function file(overrides: Record<string, unknown> = {}) {
  return {
    contentHash: "hash",
    contentSha: "content-sha",
    contentSize: 123,
    diagnostics: [],
    id: 10,
    indexedCommitSha: "abcdef123456",
    kind: "identity",
    sourceMarkdown: "# Acme",
    stateId: 7,
    status: "present",
    ...overrides,
  };
}

function createDeps() {
  return {
    db: {} as Database,
    getIdentityIndexStateBySourceControlRepositoryId: vi.fn(),
    isVerifiedLightfastIdentityRepository: vi.fn().mockReturnValue(true),
    listIdentityIndexFiles: vi.fn().mockResolvedValue([
      file(),
      file({
        contentHash: null,
        contentSha: null,
        contentSize: null,
        diagnostics: ["SOUL.md is missing."],
        kind: "soul",
        sourceMarkdown: null,
        status: "missing",
      }),
    ]),
    listIdentityIndexRefreshCandidates: vi
      .fn()
      .mockResolvedValue([candidate()]),
    readIdentityRepositoryMainRef: vi.fn().mockResolvedValue({
      defaultBranch: "trunk",
      status: "found",
    }),
    requestIdentityRefresh: vi.fn().mockResolvedValue(undefined),
  };
}

let deps: ReturnType<typeof createDeps>;

beforeEach(() => {
  deps = createDeps();
});

describe("getOrgIdentityCommand", () => {
  it("rejects pending actors before loading identity data", async () => {
    await expect(
      getOrgIdentityCommand.run({
        ctx: pendingCtx,
        deps,
        input: {},
      })
    ).rejects.toMatchObject({
      code: "ORG_REQUIRED",
      kind: "authz",
    });

    expect(deps.listIdentityIndexRefreshCandidates).not.toHaveBeenCalled();
  });

  it("returns not configured when no verified identity repository exists", async () => {
    deps.isVerifiedLightfastIdentityRepository.mockReturnValue(false);

    await expect(
      getOrgIdentityCommand.run({
        ctx: activeCtx,
        deps,
        input: {},
      })
    ).resolves.toEqual({ configured: false });

    expect(deps.listIdentityIndexRefreshCandidates).toHaveBeenCalledWith(
      deps.db,
      {
        clerkOrgId: "org_acme",
        limit: 100,
      }
    );
  });

  it("returns indexed identity files for the verified .lightfast repository", async () => {
    await expect(
      getOrgIdentityCommand.run({
        ctx: activeCtx,
        deps,
        input: {},
      })
    ).resolves.toEqual({
      configured: true,
      files: [
        {
          contentHash: "hash",
          contentSha: "content-sha",
          diagnostics: [],
          githubUrl:
            "https://github.com/acme/.lightfast/blob/trunk/IDENTITY.md",
          indexedCommitSha: "abcdef123456",
          kind: "identity",
          label: "Identity",
          path: "IDENTITY.md",
          size: 123,
          sourceMarkdown: "# Acme",
          status: "present",
        },
        {
          contentHash: null,
          contentSha: null,
          diagnostics: ["SOUL.md is missing."],
          githubUrl: "https://github.com/acme/.lightfast/blob/trunk/SOUL.md",
          indexedCommitSha: "abcdef123456",
          kind: "soul",
          label: "Soul",
          path: "SOUL.md",
          size: null,
          sourceMarkdown: null,
          status: "missing",
        },
      ],
      repository: {
        defaultBranch: "trunk",
        id: "42",
        name: ".lightfast",
        owner: "acme",
      },
      state: {
        diagnostics: [],
        indexedCommitSha: "abcdef123456",
        indexedTreeSha: "tree123",
        lastCheckedAt: indexedAt,
        lastFailureAt: null,
        lastSuccessAt: indexedAt,
        status: "succeeded",
      },
    });
  });

  it("falls back to main and asks for refresh when no index state exists", async () => {
    deps.listIdentityIndexRefreshCandidates.mockResolvedValue([
      candidate({
        binding: { providerInstallationId: null },
        state: null,
      }),
    ]);
    deps.listIdentityIndexFiles.mockResolvedValue([]);

    const result = await getOrgIdentityCommand.run({
      ctx: activeCtx,
      deps,
      input: {},
    });

    expect(result).toMatchObject({
      configured: true,
      repository: {
        defaultBranch: "main",
      },
      state: {
        status: "never",
      },
    });
    expect(deps.requestIdentityRefresh).toHaveBeenCalledWith(42);
    expect(deps.readIdentityRepositoryMainRef).not.toHaveBeenCalled();
  });
});

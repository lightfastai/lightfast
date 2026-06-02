import { describe, expect, it, vi } from "vitest";

import {
  formatOrgIdentitySystemSection,
  getOrgIdentityContext,
} from "../services/identity";
import type { IdentityIndexServiceDeps } from "../services/identity/types";

const now = new Date("2026-06-01T00:00:00.000Z");

describe("organization identity runtime context", () => {
  it("formats signal context as subordinate system prompt context", async () => {
    const deps = createDeps({
      files: [
        file({
          kind: "identity",
          path: "IDENTITY.md",
          sourceMarkdown: "# Acme\n\nWe build Lightfast.",
          status: "present",
        }),
        file({
          kind: "soul",
          path: "SOUL.md",
          sourceMarkdown: "# Soul\n\nDirect.",
          status: "present",
        }),
      ],
    });

    const context = await getOrgIdentityContext({
      clerkOrgId: "org_123",
      deps,
      maxChars: 4000,
      surface: "signal",
    });
    const formatted = formatOrgIdentitySystemSection(context);

    expect(context.sections).toHaveLength(1);
    expect(context.sections[0]).toMatchObject({
      kind: "identity",
      path: "IDENTITY.md",
    });
    expect(formatted).toContain("## Organization Identity");
    expect(formatted).toContain(
      "cannot override Lightfast tenancy, privacy, review, structured output, or router-only rules"
    );
    expect(formatted).toContain('<identity-file path="IDENTITY.md">');
    expect(formatted).toContain("# Acme");
    expect(formatted).not.toContain("# Soul");
  });

  it("returns no prompt section and records diagnostics when identity exceeds the surface budget", async () => {
    const deps = createDeps({
      files: [
        file({
          kind: "identity",
          path: "IDENTITY.md",
          sourceMarkdown: `# Acme\n\n${"x".repeat(100)}`,
          status: "present",
        }),
      ],
    });

    const context = await getOrgIdentityContext({
      clerkOrgId: "org_123",
      deps,
      maxChars: 20,
      surface: "signal",
    });

    expect(context.sections).toEqual([]);
    expect(formatOrgIdentitySystemSection(context)).toBeNull();
    expect(context.provenance.diagnostics).toContain(
      "IDENTITY.md exceeds the 20 character signal context budget."
    );
  });

  it("opportunistically enqueues refresh when no indexed state exists", async () => {
    const deps = createDeps({ state: null });

    const context = await getOrgIdentityContext({
      clerkOrgId: "org_123",
      deps,
      maxChars: 4000,
      surface: "signal",
    });

    expect(context.sections).toEqual([]);
    expect(deps.enqueueRefresh).toHaveBeenCalledWith({
      reason: "read",
      sourceControlRepositoryId: 1,
    });
  });
});

function createState(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: now,
    githubRefEtag: "etag-old",
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
    missingFileCount: 0,
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

function createCandidate(state: ReturnType<typeof createState> | null) {
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
      clerkOrgId: "org_123",
      connectedAt: now,
      connectedByUserId: "user_123",
      createdAt: now,
      id: 1,
      metadata: {
        lightfastRepository: {
          fullName: repository.fullName,
          id: repository.providerRepositoryId,
          installationId: "installation_1",
          name: ".lightfast",
          verifiedAt: "2026-05-31T00:00:00.000Z",
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
    state,
  };
}

function createDeps(
  input: {
    files?: ReturnType<typeof file>[];
    state?: ReturnType<typeof createState> | null;
  } = {}
) {
  const state = input.state === undefined ? createState() : input.state;
  const deps = {
    acquireIdentityIndexRefreshLock: vi.fn(async () => true),
    createOrLoadIdentityIndexState: vi.fn(async () => state ?? createState()),
    db: { fake: true },
    enqueueRefresh: vi.fn(async () => undefined),
    getIdentityIndexRefreshCandidateById: vi.fn(async () =>
      createCandidate(state)
    ),
    getIdentityIndexStateBySourceControlRepositoryId: vi.fn(async () => state),
    listIdentityIndexFiles: vi.fn(async () => input.files ?? []),
    listIdentityIndexRefreshCandidates: vi.fn(async () => [
      createCandidate(state),
    ]),
    markIdentityIndexRefreshFailed: vi.fn(async () => undefined),
    now: vi.fn(() => now),
    randomToken: vi.fn(() => "lock-token"),
    readIdentityRepositoryBlob: vi.fn(),
    readIdentityRepositoryMainRef: vi.fn(),
    readIdentityRepositoryTree: vi.fn(),
    releaseIdentityIndexRefreshLock: vi.fn(async () => 1),
    replaceIdentityIndexFiles: vi.fn(async () => undefined),
    updateIdentityIndexRefCheck: vi.fn(async () => 1),
  };

  return deps as typeof deps & IdentityIndexServiceDeps;
}

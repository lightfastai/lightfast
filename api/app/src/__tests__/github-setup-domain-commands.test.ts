import type { Database } from "@db/app";
import type { OrgSetupGate } from "@repo/app-setup-contract";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExecutionContext } from "../domain";
import {
  startGitHubOrgSetupCommand,
  syncGitHubBindingClaimCommand,
  verifyGitHubLightfastRepoCommand,
} from "../domain/github-setup";

const buildGitHubInstallationUrlMock = vi.fn();
const getGitHubAppConfigMock = vi.fn();
const getOrgAccessBySlugMock = vi.fn();
const isOrgAccessErrorMock = vi.fn();
const issueGitHubInstallAttemptMock = vi.fn();
const syncGitHubBindingClaimMock = vi.fn();
const verifyGitHubLightfastRepositorySetupMock = vi.fn();

const boundGate: OrgSetupGate = {
  bindingStatus: "bound",
  nextSetupRequirement: null,
};

const adminCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    orgGate: { bindingStatus: "unbound", nextSetupRequirement: "github_org" },
    orgId: "org_1",
    orgRole: "admin",
    source: "web",
    userId: "user_1",
  },
};

const memberCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    orgGate: { bindingStatus: "unbound", nextSetupRequirement: "github_org" },
    orgId: "org_1",
    source: "web",
    userId: "user_1",
  },
};

const pendingCtx: ExecutionContext = {
  actor: {
    kind: "clerkUser",
    source: "web",
    userId: "user_1",
  },
};

const serviceCtx: ExecutionContext = {
  actor: {
    kind: "service",
    service: "system",
  },
};

function createDeps() {
  return {
    buildGitHubInstallationUrl: buildGitHubInstallationUrlMock,
    db: {} as Database,
    getGitHubAppConfig: getGitHubAppConfigMock,
    getOrgAccessBySlug: getOrgAccessBySlugMock,
    isOrgAccessError: isOrgAccessErrorMock,
    issueGitHubInstallAttempt: issueGitHubInstallAttemptMock,
    syncGitHubBindingClaim: syncGitHubBindingClaimMock,
    verifyGitHubLightfastRepositorySetup:
      verifyGitHubLightfastRepositorySetupMock,
  };
}

let deps: ReturnType<typeof createDeps>;

beforeEach(() => {
  buildGitHubInstallationUrlMock.mockReset();
  getGitHubAppConfigMock.mockReset();
  getOrgAccessBySlugMock.mockReset();
  isOrgAccessErrorMock.mockReset().mockReturnValue(false);
  issueGitHubInstallAttemptMock.mockReset();
  syncGitHubBindingClaimMock.mockReset();
  verifyGitHubLightfastRepositorySetupMock.mockReset();
  deps = createDeps();

  getOrgAccessBySlugMock.mockResolvedValue({
    bindingStatus: "unbound",
    nextSetupRequirement: "github_org",
    org: {
      id: "org_1",
      imageUrl: "https://img.example.com/acme.png",
      initials: "A",
      name: "Acme",
      slug: "acme",
    },
    role: "org:admin",
  });
  getGitHubAppConfigMock.mockReturnValue({
    appSlug: "lightfast-test",
    endpoints: { webBaseUrl: "https://github.example.com" },
  });
  issueGitHubInstallAttemptMock.mockResolvedValue({ state: "state_123" });
  buildGitHubInstallationUrlMock.mockReturnValue(
    "https://github.example.com/apps/lightfast-test/installations/new?state=state_123"
  );
  syncGitHubBindingClaimMock.mockResolvedValue(boundGate);
  verifyGitHubLightfastRepositorySetupMock.mockResolvedValue(boundGate);
});

describe("startGitHubOrgSetupCommand", () => {
  it("starts a GitHub setup attempt for the active admin organization", async () => {
    await expect(
      startGitHubOrgSetupCommand.run({
        ctx: adminCtx,
        deps,
        input: { orgSlug: "acme" },
      })
    ).resolves.toEqual({
      installationUrl:
        "https://github.example.com/apps/lightfast-test/installations/new?state=state_123",
    });

    expect(getOrgAccessBySlugMock).toHaveBeenCalledWith({
      db: deps.db,
      slug: "acme",
      userId: "user_1",
    });
    expect(issueGitHubInstallAttemptMock).toHaveBeenCalledWith({
      clerkOrgId: "org_1",
      lightfastUserId: "user_1",
      orgSlug: "acme",
    });
    expect(buildGitHubInstallationUrlMock).toHaveBeenCalledWith({
      appSlug: "lightfast-test",
      state: "state_123",
      webBaseUrl: "https://github.example.com",
    });
  });

  it("rejects setup starts from non-admin members", async () => {
    await expect(
      startGitHubOrgSetupCommand.run({
        ctx: memberCtx,
        deps,
        input: { orgSlug: "acme" },
      })
    ).rejects.toMatchObject({ code: "PERMISSION_REQUIRED", kind: "authz" });

    expect(issueGitHubInstallAttemptMock).not.toHaveBeenCalled();
  });

  it("rejects setup starts for callers without an active organization", async () => {
    await expect(
      startGitHubOrgSetupCommand.run({
        ctx: pendingCtx,
        deps,
        input: { orgSlug: "acme" },
      })
    ).rejects.toMatchObject({ code: "ORG_REQUIRED", kind: "authz" });

    expect(issueGitHubInstallAttemptMock).not.toHaveBeenCalled();
  });

  it("rejects setup starts when the slug belongs to a different organization", async () => {
    getOrgAccessBySlugMock.mockResolvedValueOnce({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_org",
      org: {
        id: "org_other",
        imageUrl: "",
        initials: "O",
        name: "Other",
        slug: "acme",
      },
      role: "org:admin",
    });

    await expect(
      startGitHubOrgSetupCommand.run({
        ctx: adminCtx,
        deps,
        input: { orgSlug: "acme" },
      })
    ).rejects.toMatchObject({ code: "GITHUB_SETUP_ADMIN_REQUIRED" });

    expect(issueGitHubInstallAttemptMock).not.toHaveBeenCalled();
  });

  it("maps inaccessible organization slugs to a domain not-found error", async () => {
    const error = new Error("missing org");
    getOrgAccessBySlugMock.mockRejectedValueOnce(error);
    isOrgAccessErrorMock.mockReturnValueOnce(true);

    await expect(
      startGitHubOrgSetupCommand.run({
        ctx: adminCtx,
        deps,
        input: { orgSlug: "acme" },
      })
    ).rejects.toMatchObject({
      code: "ORG_NOT_FOUND",
      kind: "not_found",
      message: "Organization not found",
    });
  });
});

describe("syncGitHubBindingClaimCommand", () => {
  it("syncs the active org binding claim during setup", async () => {
    await expect(
      syncGitHubBindingClaimCommand.run({
        ctx: memberCtx,
        deps,
        input: {},
      })
    ).resolves.toEqual(boundGate);

    expect(syncGitHubBindingClaimMock).toHaveBeenCalledWith({
      clerkOrgId: "org_1",
    });
  });

  it("rejects binding claim sync for callers without an active organization", async () => {
    await expect(
      syncGitHubBindingClaimCommand.run({
        ctx: pendingCtx,
        deps,
        input: {},
      })
    ).rejects.toMatchObject({ code: "ORG_REQUIRED", kind: "authz" });

    expect(syncGitHubBindingClaimMock).not.toHaveBeenCalled();
  });

  it("rejects binding claim sync for non-Clerk actors", async () => {
    await expect(
      syncGitHubBindingClaimCommand.run({
        ctx: serviceCtx,
        deps,
        input: {},
      })
    ).rejects.toMatchObject({ code: "CLERK_USER_REQUIRED", kind: "authz" });

    expect(syncGitHubBindingClaimMock).not.toHaveBeenCalled();
  });
});

describe("verifyGitHubLightfastRepoCommand", () => {
  it("verifies the .lightfast repository for admins", async () => {
    await expect(
      verifyGitHubLightfastRepoCommand.run({
        ctx: adminCtx,
        deps,
        input: {},
      })
    ).resolves.toEqual(boundGate);

    expect(verifyGitHubLightfastRepositorySetupMock).toHaveBeenCalledWith({
      clerkOrgId: "org_1",
      db: deps.db,
    });
  });

  it("rejects .lightfast verification from non-admin members", async () => {
    await expect(
      verifyGitHubLightfastRepoCommand.run({
        ctx: memberCtx,
        deps,
        input: {},
      })
    ).rejects.toMatchObject({ code: "PERMISSION_REQUIRED", kind: "authz" });

    expect(verifyGitHubLightfastRepositorySetupMock).not.toHaveBeenCalled();
  });

  it("maps transient verification failures to internal domain errors", async () => {
    verifyGitHubLightfastRepositorySetupMock.mockRejectedValueOnce({
      code: "github_transient_error",
      message: "Lightfast could not verify the .lightfast repository.",
      name: "GitHubLightfastRepositorySetupError",
    });

    await expect(
      verifyGitHubLightfastRepoCommand.run({
        ctx: adminCtx,
        deps,
        input: {},
      })
    ).rejects.toMatchObject({
      code: "GITHUB_SETUP_TRANSIENT",
      kind: "internal",
    });
  });
});

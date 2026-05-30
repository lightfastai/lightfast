import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getActiveOrgBindingMock = vi.fn();

vi.mock("@db/app", () => ({
  getActiveOrgBinding: getActiveOrgBindingMock,
}));

const { resolveOrgSetupGate } = await import("../auth/org-setup-gate");

function activeGitHubBinding(
  metadata: Record<string, unknown> = {},
  overrides: Record<string, unknown> = {}
) {
  return {
    clerkOrgId: "org_acme",
    connectedAt: new Date("2026-05-30T00:00:00.000Z"),
    connectedByUserId: "user_admin",
    createdAt: new Date("2026-05-30T00:00:00.000Z"),
    id: 1,
    metadata,
    provider: "github",
    providerAccountId: "123",
    providerAccountLogin: "acme",
    providerInstallationId: "1001",
    revokedAt: null,
    status: "active",
    updatedAt: new Date("2026-05-30T00:00:00.000Z"),
    ...overrides,
  };
}

describe("resolveOrgSetupGate", () => {
  beforeEach(() => {
    getActiveOrgBindingMock.mockReset();
  });

  it("requires the GitHub org first when no active binding exists", async () => {
    getActiveOrgBindingMock.mockResolvedValue(undefined);

    await expect(
      resolveOrgSetupGate({ db: {} as Database, clerkOrgId: "org_acme" })
    ).resolves.toEqual({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_org",
    });
  });

  it("requires the .lightfast repository after the GitHub org is bound", async () => {
    getActiveOrgBindingMock.mockResolvedValue(activeGitHubBinding());

    await expect(
      resolveOrgSetupGate({ db: {} as Database, clerkOrgId: "org_acme" })
    ).resolves.toEqual({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_lightfast_repo",
    });
  });

  it("is bound when the active binding has a matching .lightfast proof", async () => {
    getActiveOrgBindingMock.mockResolvedValue(
      activeGitHubBinding({
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "987",
          installationId: "1001",
          name: ".lightfast",
          verifiedAt: "2026-05-30T10:00:00.000Z",
        },
      })
    );

    await expect(
      resolveOrgSetupGate({ db: {} as Database, clerkOrgId: "org_acme" })
    ).resolves.toEqual({
      bindingStatus: "bound",
      nextSetupRequirement: null,
    });
  });

  it("ignores stale .lightfast proof for a different installation", async () => {
    getActiveOrgBindingMock.mockResolvedValue(
      activeGitHubBinding({
        lightfastRepository: {
          fullName: "acme/.lightfast",
          id: "987",
          installationId: "9999",
          name: ".lightfast",
          verifiedAt: "2026-05-30T10:00:00.000Z",
        },
      })
    );

    await expect(
      resolveOrgSetupGate({ db: {} as Database, clerkOrgId: "org_acme" })
    ).resolves.toEqual({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_lightfast_repo",
    });
  });

  it("ignores stale .lightfast proof for a different GitHub org", async () => {
    getActiveOrgBindingMock.mockResolvedValue(
      activeGitHubBinding({
        lightfastRepository: {
          fullName: "other/.lightfast",
          id: "987",
          installationId: "1001",
          name: ".lightfast",
          verifiedAt: "2026-05-30T10:00:00.000Z",
        },
      })
    );

    await expect(
      resolveOrgSetupGate({ db: {} as Database, clerkOrgId: "org_acme" })
    ).resolves.toEqual({
      bindingStatus: "unbound",
      nextSetupRequirement: "github_lightfast_repo",
    });
  });
});

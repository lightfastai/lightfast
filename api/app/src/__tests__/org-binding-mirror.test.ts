import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrganizationMock = vi.fn();
const updateOrganizationMock = vi.fn();

vi.mock("@vendor/clerk/server", () => ({
  clerkClient: () =>
    Promise.resolve({
      organizations: {
        getOrganization: getOrganizationMock,
        updateOrganization: updateOrganizationMock,
      },
    }),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { mirrorOrgSetupGate } = await import("../auth/org-binding-mirror");

/** The `publicMetadata` object passed to `updateOrganization` for call `n`. */
function writtenPublicMetadata(call = 0): Record<string, unknown> {
  const args = updateOrganizationMock.mock.calls[call];
  if (!args) {
    throw new Error(`updateOrganization was not called ${call + 1} time(s)`);
  }
  return (args[1] as { publicMetadata: Record<string, unknown> })
    .publicMetadata;
}

function writtenBinding(call = 0): Record<string, unknown> {
  const lightfast = writtenPublicMetadata(call).lightfast as Record<
    string,
    unknown
  >;
  return lightfast.binding as Record<string, unknown>;
}

beforeEach(() => {
  getOrganizationMock.mockReset();
  updateOrganizationMock.mockReset();
  updateOrganizationMock.mockResolvedValue(undefined);
});

describe("mirrorOrgSetupGate", () => {
  it("stores the next setup requirement while the org is unbound", async () => {
    getOrganizationMock.mockResolvedValueOnce({ publicMetadata: {} });

    await mirrorOrgSetupGate({
      clerkOrgId: "org_8",
      gate: {
        bindingStatus: "unbound",
        nextSetupRequirement: "github_lightfast_repo",
      },
    });

    const written = writtenPublicMetadata();
    expect(writtenBinding()).toMatchObject({
      status: "unbound",
      provider: "github",
    });
    expect(written.lightfast as Record<string, unknown>).toMatchObject({
      nextSetupRequirement: "github_lightfast_repo",
    });
  });

  it("clears the next setup requirement when the org is bound", async () => {
    getOrganizationMock.mockResolvedValueOnce({
      publicMetadata: {
        lightfast: {
          nextSetupRequirement: "github_lightfast_repo",
        },
      },
    });

    await mirrorOrgSetupGate({
      clerkOrgId: "org_9",
      gate: {
        bindingStatus: "bound",
        nextSetupRequirement: null,
      },
    });

    expect(writtenBinding()).toMatchObject({
      status: "bound",
      provider: "github",
    });
    expect(writtenPublicMetadata().lightfast).not.toHaveProperty(
      "nextSetupRequirement"
    );
  });

  it("preserves unrelated publicMetadata keys and sibling lightfast.* keys", async () => {
    getOrganizationMock.mockResolvedValueOnce({
      publicMetadata: {
        billingTier: "free",
        onboarding: { dismissed: true },
        lightfast: {
          someOtherFeature: { enabled: true },
        },
      },
    });

    await mirrorOrgSetupGate({
      clerkOrgId: "org_10",
      gate: {
        bindingStatus: "unbound",
        nextSetupRequirement: "github_org",
      },
    });

    const written = writtenPublicMetadata();
    expect(written.billingTier).toBe("free");
    expect(written.onboarding).toEqual({ dismissed: true });
    expect(
      (written.lightfast as Record<string, unknown>).someOtherFeature
    ).toEqual({ enabled: true });
    expect(writtenBinding().status).toBe("unbound");
  });

  it("overwrites stale binding keys and never writes provider secrets", async () => {
    getOrganizationMock.mockResolvedValueOnce({
      publicMetadata: {
        lightfast: {
          binding: {
            status: "bound",
            provider: "github",
            updatedAt: "2020-01-01T00:00:00.000Z",
            staleLeftover: "should-be-gone",
          },
        },
      },
    });

    await mirrorOrgSetupGate({
      clerkOrgId: "org_11",
      gate: {
        bindingStatus: "bound",
        nextSetupRequirement: null,
      },
    });

    expect(Object.keys(writtenBinding()).sort()).toEqual([
      "provider",
      "status",
      "updatedAt",
    ]);
    expect(writtenBinding()).not.toHaveProperty("staleLeftover");
    expect(writtenBinding().updatedAt).toEqual(expect.any(String));
  });

  it("throws when the Clerk update fails", async () => {
    getOrganizationMock.mockResolvedValueOnce({ publicMetadata: {} });
    updateOrganizationMock.mockRejectedValueOnce(new Error("clerk 500"));

    await expect(
      mirrorOrgSetupGate({
        clerkOrgId: "org_12",
        gate: {
          bindingStatus: "bound",
          nextSetupRequirement: null,
        },
      })
    ).rejects.toThrow("clerk 500");
  });
});

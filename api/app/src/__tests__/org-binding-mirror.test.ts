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

const { mirrorOrgBinding } = await import("../auth/org-binding-mirror");

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

describe("mirrorOrgBinding", () => {
  it("sets lightfast.binding.status to 'bound'", async () => {
    getOrganizationMock.mockResolvedValueOnce({ publicMetadata: {} });

    await mirrorOrgBinding({ clerkOrgId: "org_1", status: "bound" });

    expect(getOrganizationMock).toHaveBeenCalledWith({
      organizationId: "org_1",
    });
    expect(updateOrganizationMock).toHaveBeenCalledWith(
      "org_1",
      expect.objectContaining({ publicMetadata: expect.any(Object) })
    );
    expect(writtenBinding()).toMatchObject({
      status: "bound",
      provider: "github",
    });
  });

  it("writes a 'revoked' status for the revoked mirror — away from bound", async () => {
    getOrganizationMock.mockResolvedValueOnce({
      publicMetadata: {
        lightfast: { binding: { status: "bound", provider: "github" } },
      },
    });

    await mirrorOrgBinding({ clerkOrgId: "org_2", status: "revoked" });

    expect(writtenBinding().status).toBe("revoked");
    expect(writtenBinding().status).not.toBe("bound");
  });

  it("preserves unrelated publicMetadata keys and sibling lightfast.* keys", async () => {
    getOrganizationMock.mockResolvedValueOnce({
      publicMetadata: {
        billingTier: "free",
        onboarding: { dismissed: true },
        lightfast: {
          // a sibling lightfast feature key — must survive the round-trip
          someOtherFeature: { enabled: true },
        },
      },
    });

    await mirrorOrgBinding({ clerkOrgId: "org_3", status: "bound" });

    const written = writtenPublicMetadata();
    expect(written.billingTier).toBe("free");
    expect(written.onboarding).toEqual({ dismissed: true });
    expect(
      (written.lightfast as Record<string, unknown>).someOtherFeature
    ).toEqual({ enabled: true });
    expect(writtenBinding().status).toBe("bound");
  });

  it("overwrites a stale binding subtree without leaking its old keys", async () => {
    getOrganizationMock.mockResolvedValueOnce({
      publicMetadata: {
        lightfast: {
          binding: {
            status: "revoked",
            provider: "github",
            updatedAt: "2020-01-01T00:00:00.000Z",
            staleLeftover: "should-be-gone",
          },
        },
      },
    });

    await mirrorOrgBinding({ clerkOrgId: "org_4", status: "bound" });

    expect(writtenBinding()).not.toHaveProperty("staleLeftover");
  });

  it("never writes provider secrets — the binding subtree is exactly status/provider/updatedAt", async () => {
    getOrganizationMock.mockResolvedValueOnce({ publicMetadata: {} });

    await mirrorOrgBinding({ clerkOrgId: "org_5", status: "bound" });

    expect(Object.keys(writtenBinding()).sort()).toEqual([
      "provider",
      "status",
      "updatedAt",
    ]);
    expect(writtenBinding().updatedAt).toEqual(expect.any(String));
  });

  it("defaults the provider to 'github' and forwards an explicit provider", async () => {
    getOrganizationMock.mockResolvedValue({ publicMetadata: {} });

    await mirrorOrgBinding({ clerkOrgId: "org_6", status: "bound" });
    expect(writtenBinding(0).provider).toBe("github");

    await mirrorOrgBinding({
      clerkOrgId: "org_6",
      status: "bound",
      provider: "github",
    });
    expect(writtenBinding(1).provider).toBe("github");
  });

  it("throws when the Clerk update fails — failures are never swallowed", async () => {
    getOrganizationMock.mockResolvedValueOnce({ publicMetadata: {} });
    updateOrganizationMock.mockRejectedValueOnce(new Error("clerk 500"));

    await expect(
      mirrorOrgBinding({ clerkOrgId: "org_7", status: "bound" })
    ).rejects.toThrow("clerk 500");
  });
});

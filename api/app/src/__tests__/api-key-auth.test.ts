import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveOrgBinding: vi.fn(),
  getCurrentOrgConnectorConnection: vi.fn(),
  verifyKey: vi.fn(),
}));

vi.mock("@db/app/client", () => ({ db: { kind: "mock-db" } }));
vi.mock("@db/app", () => ({
  getActiveOrgBinding: mocks.getActiveOrgBinding,
  getCurrentOrgConnectorConnection: mocks.getCurrentOrgConnectorConnection,
}));

vi.mock("@vendor/unkey/server", () => ({
  getUnkeyClient: () => ({
    keys: { verifyKey: mocks.verifyKey },
  }),
}));

const { resolveApiKeyAuth } = await import("../auth/api-key");

const validKey = `lf_${"a".repeat(40)}`;

function verifyResult(
  overrides: Partial<{
    code: string;
    identity: { externalId?: string; id: string } | undefined;
    keyId: string | undefined;
    meta: Record<string, unknown> | undefined;
    valid: boolean;
  }> = {}
) {
  return {
    data: {
      code: "VALID",
      identity: { externalId: "org_test", id: "identity_test" },
      keyId: "key_test",
      meta: { createdByUserId: "user_test" },
      valid: true,
      ...overrides,
    },
    meta: { requestId: "req_test" },
  };
}

function headers(authorization?: string) {
  return new Headers(authorization ? { authorization } : undefined);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCurrentOrgConnectorConnection.mockResolvedValue({
    status: "active",
  });
  mocks.getActiveOrgBinding.mockResolvedValue({
    metadata: {
      lightfastRepository: {
        fullName: "acme/.lightfast",
        id: "987",
        installationId: "1001",
        name: ".lightfast",
        verifiedAt: "2026-05-30T10:00:00.000Z",
      },
    },
    provider: "github",
    providerAccountLogin: "acme",
    providerInstallationId: "1001",
  });
});

describe("resolveApiKeyAuth", () => {
  it("rejects requests without a bearer token before calling Unkey", async () => {
    await expect(
      resolveApiKeyAuth({ headers: headers() })
    ).rejects.toMatchObject({
      message: expect.stringContaining("API key required"),
      reason: "missing",
      status: 401,
    });
    expect(mocks.verifyKey).not.toHaveBeenCalled();
    expect(mocks.getActiveOrgBinding).not.toHaveBeenCalled();
  });

  it("rejects non-Bearer schemes before calling Unkey", async () => {
    await expect(
      resolveApiKeyAuth({ headers: headers(`Basic ${validKey}`) })
    ).rejects.toMatchObject({
      message: expect.stringContaining("API key required"),
      reason: "missing",
      status: 401,
    });
    expect(mocks.verifyKey).not.toHaveBeenCalled();
  });

  it("rejects keys without the public lf_ prefix before calling Unkey", async () => {
    await expect(
      resolveApiKeyAuth({ headers: headers("Bearer ak_legacy_key") })
    ).rejects.toMatchObject({
      message: expect.stringContaining("Invalid API key format"),
      reason: "invalid-format",
      status: 401,
    });
    expect(mocks.verifyKey).not.toHaveBeenCalled();
  });

  it("rejects Unkey verification errors as invalid API keys", async () => {
    mocks.verifyKey.mockRejectedValueOnce(new Error("unkey down"));

    await expect(
      resolveApiKeyAuth({ headers: headers(`Bearer ${validKey}`) })
    ).rejects.toMatchObject({
      message: "Invalid API key",
      reason: "invalid",
      status: 401,
    });
    expect(mocks.verifyKey).toHaveBeenCalledWith({ key: validKey });
    expect(mocks.getActiveOrgBinding).not.toHaveBeenCalled();
  });

  it("maps disabled and expired Unkey keys to auth failures", async () => {
    mocks.verifyKey
      .mockResolvedValueOnce(verifyResult({ code: "DISABLED", valid: false }))
      .mockResolvedValueOnce(verifyResult({ code: "EXPIRED", valid: false }));

    await expect(
      resolveApiKeyAuth({ headers: headers(`Bearer ${validKey}`) })
    ).rejects.toMatchObject({
      message: "API key disabled",
      reason: "disabled",
      status: 401,
    });
    await expect(
      resolveApiKeyAuth({ headers: headers(`Bearer ${validKey}`) })
    ).rejects.toMatchObject({
      message: "API key expired",
      reason: "expired",
      status: 401,
    });
  });

  it("requires org-scoped identity and creator metadata", async () => {
    mocks.verifyKey
      .mockResolvedValueOnce(verifyResult({ identity: undefined }))
      .mockResolvedValueOnce(verifyResult({ meta: {} }));

    await expect(
      resolveApiKeyAuth({ headers: headers(`Bearer ${validKey}`) })
    ).rejects.toMatchObject({
      message: "API key is not org-scoped",
      reason: "not-org-scoped",
      status: 403,
    });
    await expect(
      resolveApiKeyAuth({ headers: headers(`Bearer ${validKey}`) })
    ).rejects.toMatchObject({
      message: "API key is missing creator metadata",
      reason: "missing-creator",
      status: 403,
    });
  });

  it("resolves a valid API key to the shared active auth identity", async () => {
    mocks.verifyKey.mockResolvedValueOnce(verifyResult());

    await expect(
      resolveApiKeyAuth({ headers: headers(`bearer ${validKey}`) })
    ).resolves.toEqual({
      apiKeyId: "key_test",
      identity: {
        orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
        orgId: "org_test",
        type: "active",
        userId: "user_test",
      },
    });
    expect(mocks.getActiveOrgBinding).toHaveBeenCalledWith(
      expect.anything(),
      "org_test"
    );
  });

  it("keeps auth valid while exposing an unbound org gate", async () => {
    mocks.verifyKey.mockResolvedValueOnce(verifyResult());
    mocks.getActiveOrgBinding.mockResolvedValueOnce(undefined);

    await expect(
      resolveApiKeyAuth({ headers: headers(`Bearer ${validKey}`) })
    ).resolves.toMatchObject({
      identity: {
        orgGate: {
          bindingStatus: "unbound",
          nextSetupRequirement: "github_org",
        },
        orgId: "org_test",
        type: "active",
      },
    });
  });
});

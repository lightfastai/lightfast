import type { KeyResponseData } from "@vendor/unkey";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  createDefaultOrgApiKeyCommandDeps,
  createOrgApiKeyCommand,
  deleteOrgApiKeyCommand,
  listOrgApiKeysCommand,
  revokeOrgApiKeyCommand,
  rotateOrgApiKeyCommand,
} from "../domain/org-api-keys";

const mocks = vi.hoisted(() => ({
  apisListKeysMock: vi.fn(),
  identitiesCreateIdentityMock: vi.fn(),
  keysCreateKeyMock: vi.fn(),
  keysDeleteKeyMock: vi.fn(),
  keysGetKeyMock: vi.fn(),
  keysRerollKeyMock: vi.fn(),
  keysUpdateKeyMock: vi.fn(),
  logInfoMock: vi.fn(),
}));

vi.mock("@vendor/unkey/server", () => ({
  unkeyEnv: { UNKEY_API_ID: "api_test" },
  getUnkeyClient: () => ({
    apis: { listKeys: mocks.apisListKeysMock },
    identities: { createIdentity: mocks.identitiesCreateIdentityMock },
    keys: {
      createKey: mocks.keysCreateKeyMock,
      deleteKey: mocks.keysDeleteKeyMock,
      getKey: mocks.keysGetKeyMock,
      rerollKey: mocks.keysRerollKeyMock,
      updateKey: mocks.keysUpdateKeyMock,
    },
  }),
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: { info: mocks.logInfoMock },
}));

const identity: Extract<AuthIdentity, { type: "active" }> = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "unbound", nextSetupRequirement: "github_org" },
};

const key: KeyResponseData = {
  createdAt: 1_700_000_000_000,
  enabled: true,
  identity: { externalId: "org_test", id: "identity_test" },
  keyId: "key_test",
  meta: { createdByUserId: "user_test" },
  name: "Test key",
  start: "lf_live",
  updatedAt: 1_700_000_000_000,
};

function ctx({ admin = false }: { admin?: boolean } = {}) {
  return {
    actor: {
      ...actorFromAuthIdentity(identity, "web"),
      ...(admin ? { orgRole: "admin" } : {}),
    },
    request: { id: "req_test", source: "tanstack" as const },
  };
}

function deps() {
  return createDefaultOrgApiKeyCommandDeps({ now: () => 1_700_000_000_000 });
}

beforeEach(() => {
  mocks.apisListKeysMock.mockReset();
  mocks.apisListKeysMock
    .mockResolvedValueOnce({
      data: [key],
      pagination: { cursor: "cursor_2", hasMore: true },
    })
    .mockResolvedValueOnce({
      data: [{ ...key, keyId: "key_second", start: "lf_second" }],
      pagination: { hasMore: false },
    });
  mocks.identitiesCreateIdentityMock.mockReset();
  mocks.identitiesCreateIdentityMock.mockResolvedValue({
    data: { externalId: "org_test", id: "identity_test" },
  });
  mocks.keysCreateKeyMock.mockReset();
  mocks.keysCreateKeyMock.mockResolvedValue({
    data: { key: "lf_secret_value", keyId: "key_test" },
  });
  mocks.keysDeleteKeyMock.mockReset();
  mocks.keysDeleteKeyMock.mockResolvedValue({ data: {} });
  mocks.keysGetKeyMock.mockReset();
  mocks.keysGetKeyMock.mockResolvedValue({ data: key });
  mocks.keysRerollKeyMock.mockReset();
  mocks.keysRerollKeyMock.mockResolvedValue({
    data: { key: "lf_rotated_secret", keyId: "key_test" },
  });
  mocks.keysUpdateKeyMock.mockReset();
  mocks.keysUpdateKeyMock.mockResolvedValue({
    data: { ...key, enabled: false },
  });
  mocks.logInfoMock.mockReset();
});

describe("org API key domain commands", () => {
  it("lists all pages for the active Clerk organization without requiring binding", async () => {
    await expect(
      listOrgApiKeysCommand.run({ ctx: ctx(), deps: deps(), input: {} })
    ).resolves.toEqual([
      key,
      { ...key, keyId: "key_second", start: "lf_second" },
    ]);

    expect(mocks.apisListKeysMock).toHaveBeenNthCalledWith(1, {
      apiId: "api_test",
      cursor: undefined,
      decrypt: false,
      externalId: "org_test",
      limit: 100,
    });
    expect(mocks.apisListKeysMock).toHaveBeenNthCalledWith(2, {
      apiId: "api_test",
      cursor: "cursor_2",
      decrypt: false,
      externalId: "org_test",
      limit: 100,
    });
  });

  it("creates an org-scoped Unkey key for a Clerk org admin", async () => {
    await expect(
      createOrgApiKeyCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { name: "Test key", secondsUntilExpiration: 60 },
      })
    ).resolves.toEqual({ key: "lf_secret_value", keyId: "key_test" });

    expect(mocks.identitiesCreateIdentityMock).toHaveBeenCalledWith({
      externalId: "org_test",
      meta: { clerkOrgId: "org_test" },
    });
    expect(mocks.keysCreateKeyMock).toHaveBeenCalledWith({
      apiId: "api_test",
      expires: 1_700_000_060_000,
      externalId: "org_test",
      meta: { createdByUserId: "user_test", source: "dashboard" },
      name: "Test key",
      prefix: "lf",
      recoverable: false,
    });
  });

  it("treats existing Unkey identities as create success", async () => {
    const conflict = Object.assign(new Error("already exists"), {
      statusCode: 409,
    });
    mocks.identitiesCreateIdentityMock.mockRejectedValueOnce(conflict);

    await expect(
      createOrgApiKeyCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { name: "Test key" },
      })
    ).resolves.toEqual({ key: "lf_secret_value", keyId: "key_test" });
  });

  it("revokes, deletes, and rotates only keys owned by the active organization", async () => {
    await expect(
      revokeOrgApiKeyCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { keyId: "key_test" },
      })
    ).resolves.toEqual({ success: true });
    await expect(
      deleteOrgApiKeyCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { keyId: "key_test" },
      })
    ).resolves.toEqual({ success: true });
    await expect(
      rotateOrgApiKeyCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { keyId: "key_test" },
      })
    ).resolves.toEqual({ key: "lf_rotated_secret", keyId: "key_test" });

    expect(mocks.keysUpdateKeyMock).toHaveBeenCalledWith({
      enabled: false,
      keyId: "key_test",
    });
    expect(mocks.keysDeleteKeyMock).toHaveBeenCalledWith({
      keyId: "key_test",
      permanent: false,
    });
    expect(mocks.keysRerollKeyMock).toHaveBeenCalledWith({
      expiration: 0,
      keyId: "key_test",
    });
  });

  it("hides another organization's key as not found", async () => {
    mocks.keysGetKeyMock.mockResolvedValueOnce({
      data: {
        ...key,
        identity: { externalId: "org_other", id: "identity_other" },
      },
    });

    await expect(
      rotateOrgApiKeyCommand.run({
        ctx: ctx({ admin: true }),
        deps: deps(),
        input: { keyId: "key_other" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "ORG_API_KEY_NOT_FOUND",
        kind: "not_found",
      })
    );
    expect(mocks.keysRerollKeyMock).not.toHaveBeenCalled();
  });

  it("requires a matching admin actor for writes", async () => {
    await expect(
      createOrgApiKeyCommand.run({
        ctx: ctx(),
        deps: deps(),
        input: { name: "Test key" },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "PERMISSION_REQUIRED",
        kind: "authz",
      })
    );
    expect(mocks.keysCreateKeyMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "../auth/identity";
import { actorFromAuthIdentity } from "../domain";
import {
  createOrgApiKeyCommand,
  deleteOrgApiKeyCommand,
  listOrgApiKeysCommand,
  type OrgApiKeyCommandDeps,
  type OrgApiKeyListItem,
  revokeOrgApiKeyCommand,
  rotateOrgApiKeyCommand,
} from "../domain/org-api-keys";

const apisListKeysMock = vi.fn();
const identitiesCreateIdentityMock = vi.fn();
const keysCreateKeyMock = vi.fn();
const keysDeleteKeyMock = vi.fn();
const keysGetKeyMock = vi.fn();
const keysRerollKeyMock = vi.fn();
const keysUpdateKeyMock = vi.fn();
const logInfoMock = vi.fn();

const identity: Extract<AuthIdentity, { type: "active" }> = {
  type: "active",
  userId: "user_test",
  orgId: "org_test",
  orgGate: { bindingStatus: "unbound", nextSetupRequirement: "github_org" },
};

const key: OrgApiKeyListItem = {
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
  return {
    apiId: "api_test",
    isProviderConflictError: (error) =>
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      error.statusCode === 409,
    isProviderNotFoundError: (error) =>
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      error.statusCode === 404,
    log: { info: logInfoMock },
    now: () => 1_700_000_000_000,
    provider: {
      apis: { listKeys: apisListKeysMock },
      identities: { createIdentity: identitiesCreateIdentityMock },
      keys: {
        createKey: keysCreateKeyMock,
        deleteKey: keysDeleteKeyMock,
        getKey: keysGetKeyMock,
        rerollKey: keysRerollKeyMock,
        updateKey: keysUpdateKeyMock,
      },
    },
  } satisfies OrgApiKeyCommandDeps;
}

beforeEach(() => {
  apisListKeysMock.mockReset();
  apisListKeysMock
    .mockResolvedValueOnce({
      data: [key],
      pagination: { cursor: "cursor_2", hasMore: true },
    })
    .mockResolvedValueOnce({
      data: [{ ...key, keyId: "key_second", start: "lf_second" }],
      pagination: { hasMore: false },
    });
  identitiesCreateIdentityMock.mockReset();
  identitiesCreateIdentityMock.mockResolvedValue({
    data: { externalId: "org_test", id: "identity_test" },
  });
  keysCreateKeyMock.mockReset();
  keysCreateKeyMock.mockResolvedValue({
    data: { key: "lf_secret_value", keyId: "key_test" },
  });
  keysDeleteKeyMock.mockReset();
  keysDeleteKeyMock.mockResolvedValue({ data: {} });
  keysGetKeyMock.mockReset();
  keysGetKeyMock.mockResolvedValue({ data: key });
  keysRerollKeyMock.mockReset();
  keysRerollKeyMock.mockResolvedValue({
    data: { key: "lf_rotated_secret", keyId: "key_test" },
  });
  keysUpdateKeyMock.mockReset();
  keysUpdateKeyMock.mockResolvedValue({
    data: { ...key, enabled: false },
  });
  logInfoMock.mockReset();
});

describe("org API key domain commands", () => {
  it("lists all pages for the active Clerk organization without requiring binding", async () => {
    await expect(
      listOrgApiKeysCommand.run({ ctx: ctx(), deps: deps(), input: {} })
    ).resolves.toEqual([
      key,
      { ...key, keyId: "key_second", start: "lf_second" },
    ]);

    expect(apisListKeysMock).toHaveBeenNthCalledWith(1, {
      apiId: "api_test",
      cursor: undefined,
      decrypt: false,
      externalId: "org_test",
      limit: 100,
    });
    expect(apisListKeysMock).toHaveBeenNthCalledWith(2, {
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

    expect(identitiesCreateIdentityMock).toHaveBeenCalledWith({
      externalId: "org_test",
      meta: { clerkOrgId: "org_test" },
    });
    expect(keysCreateKeyMock).toHaveBeenCalledWith({
      apiId: "api_test",
      expires: 1_700_000_060_000,
      externalId: "org_test",
      meta: { createdByUserId: "user_test", source: "dashboard" },
      name: "Test key",
      permissions: ["api.signals.read", "api.signals.write"],
      prefix: "lf",
      recoverable: false,
    });
  });

  it("treats existing Unkey identities as create success", async () => {
    const conflict = Object.assign(new Error("already exists"), {
      statusCode: 409,
    });
    identitiesCreateIdentityMock.mockRejectedValueOnce(conflict);

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

    expect(keysUpdateKeyMock).toHaveBeenCalledWith({
      enabled: false,
      keyId: "key_test",
    });
    expect(keysDeleteKeyMock).toHaveBeenCalledWith({
      keyId: "key_test",
      permanent: false,
    });
    expect(keysRerollKeyMock).toHaveBeenCalledWith({
      expiration: 0,
      keyId: "key_test",
    });
  });

  it("hides another organization's key as not found", async () => {
    keysGetKeyMock.mockResolvedValueOnce({
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
    expect(keysRerollKeyMock).not.toHaveBeenCalled();
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
    expect(keysCreateKeyMock).not.toHaveBeenCalled();
  });
});

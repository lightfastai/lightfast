import type { Database } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const encryptMock = vi.fn(async (value: string) => `encrypted:${value}`);
const decryptMock = vi.fn(async (value: string) =>
  value.startsWith("encrypted:") ? value.slice("encrypted:".length) : value
);
const listCurrentDeveloperConnectionsMock = vi.fn();
const replaceCurrentDeveloperConnectionMock = vi.fn();
const setCurrentDeveloperConnectionSandboxEnabledMock = vi.fn();
const revokeCurrentDeveloperConnectionMock = vi.fn();
const issueDeveloperConnectionLeaseMock = vi.fn();
const sentryAuthBoxStartMock = vi.fn();
const sentryAuthBoxCompleteMock = vi.fn();

const envMock = {
  DEVELOPER_AUTH_BOX_ORIGIN: "https://auth-box.lightfast.test",
  DEVELOPER_AUTH_BOX_TOKEN: "auth_box_token",
  ENCRYPTION_KEY:
    "0000000000000000000000000000000000000000000000000000000000000000",
  VERCEL_ENV: "development",
};

vi.mock("../env", () => ({ env: envMock }));

vi.mock("@repo/app-encryption", () => ({
  encrypt: encryptMock,
  decrypt: decryptMock,
}));

vi.mock("@db/app", () => ({
  listCurrentDeveloperConnections: listCurrentDeveloperConnectionsMock,
  replaceCurrentDeveloperConnection: replaceCurrentDeveloperConnectionMock,
  setCurrentDeveloperConnectionSandboxEnabled:
    setCurrentDeveloperConnectionSandboxEnabledMock,
  revokeCurrentDeveloperConnection: revokeCurrentDeveloperConnectionMock,
  issueDeveloperConnectionLease: issueDeveloperConnectionLeaseMock,
}));

vi.mock("../services/developer-connections/auth-box", () => ({
  sentryAuthBoxClient: {
    start: sentryAuthBoxStartMock,
    complete: sentryAuthBoxCompleteMock,
  },
}));

const {
  completeSentryDeveloperConnectionAuth,
  connectDeveloperConnection,
  disconnectDeveloperConnection,
  issueDeveloperConnectionLeases,
  listDeveloperConnectionsForOrg,
  setDeveloperConnectionSandboxEnabled,
  startSentryDeveloperConnectionAuth,
} = await import("../services/developer-connections");

function ctx(input: { isAdmin?: boolean } = {}) {
  return {
    auth: {
      access: {
        kind: "clerk-session" as const,
        userId: "user_admin",
        orgId: "org_acme",
        has: ({ role }: { role?: string }) =>
          (input.isAdmin ?? true) ? role === "org:admin" : false,
      },
      identity: {
        type: "active" as const,
        userId: "user_admin",
        orgId: "org_acme",
        orgGate: {
          bindingStatus: "bound" as const,
          nextSetupRequirement: null,
        },
      },
    },
    db: {} as Database,
    headers: new Headers(),
  };
}

describe("developer connection services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listCurrentDeveloperConnectionsMock.mockResolvedValue([]);
    replaceCurrentDeveloperConnectionMock.mockImplementation(
      async (_db, input) => ({
        id: 1,
        publicId: "developer_connection_1",
        clerkOrgId: input.clerkOrgId,
        provider: input.provider,
        providerAccountName: input.providerAccountName,
        providerAccountId: input.providerAccountId,
        status: "connected",
        enabledForSandboxes: true,
        credentialKind: input.credentialKind,
        credentialSchemaVersion: input.credentialSchemaVersion,
        encryptedCredential: input.encryptedCredential,
        scopes: input.scopes,
        metadata: input.metadata,
        expiresAt: input.expiresAt,
        lastVerifiedAt: input.verifiedAt,
        lastUsedAt: null,
        lastUsedByUserId: null,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
        createdAt: input.verifiedAt,
        updatedAt: input.verifiedAt,
        revokedAt: null,
      })
    );
    issueDeveloperConnectionLeaseMock.mockResolvedValue({
      id: 10,
      publicId: "developer_connection_lease_1",
      connectionId: 1,
      clerkOrgId: "org_acme",
      actorUserId: "user_admin",
      provider: "sentry",
      status: "issued",
      sandboxRunId: "sandbox_run_1",
      workflowRunId: "workflow_run_1",
      requestedAt: new Date("2026-06-03T00:00:00.000Z"),
      issuedAt: new Date("2026-06-03T00:00:00.000Z"),
      materializedAt: null,
      expiresAt: new Date("2026-06-03T00:15:00.000Z"),
      revokedAt: null,
      failureCode: null,
      createdAt: new Date("2026-06-03T00:00:00.000Z"),
      updatedAt: new Date("2026-06-03T00:00:00.000Z"),
    });
    sentryAuthBoxStartMock.mockResolvedValue({
      attemptId: "auth_attempt_1",
      expiresAt: new Date("2026-06-03T00:05:00.000Z"),
      userCode: "ABCD-EFGH",
      verificationUri: "https://sentry.io/account/settings/auth-tokens/",
    });
    sentryAuthBoxCompleteMock.mockResolvedValue({
      providerAccountId: "org:lightfast",
      providerAccountName: "lightfast/app",
      scopes: ["org:read", "project:read", "event:read"],
      token: "sentry-oauth-token",
      expiresAt: null,
    });
  });

  it("lists the four provider catalog rows with admin manage state", async () => {
    await expect(listDeveloperConnectionsForOrg(ctx())).resolves.toEqual([
      expect.objectContaining({ provider: "pscale", canManage: true }),
      expect.objectContaining({ provider: "upstash", canManage: true }),
      expect.objectContaining({ provider: "sentry", canManage: true }),
      expect.objectContaining({ provider: "clerk", canManage: true }),
    ]);
  });

  it("encrypts manual PlanetScale credentials and stores a current org connection", async () => {
    await connectDeveloperConnection(ctx(), {
      provider: "pscale",
      providerAccountName: "lightfast/main",
      serviceTokenId: "token-id",
      serviceToken: "token-secret",
    });

    expect(encryptMock).toHaveBeenCalledWith(
      JSON.stringify({
        serviceTokenId: "token-id",
        serviceToken: "token-secret",
      }),
      envMock.ENCRYPTION_KEY
    );
    expect(replaceCurrentDeveloperConnectionMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        clerkOrgId: "org_acme",
        provider: "pscale",
        providerAccountName: "lightfast/main",
        credentialKind: "pscale_service_token",
        actorUserId: "user_admin",
      })
    );
  });

  it("starts and completes Sentry auth through the auth-box client", async () => {
    await expect(
      startSentryDeveloperConnectionAuth(ctx(), {
        provider: "sentry",
        providerAccountName: "lightfast/app",
      })
    ).resolves.toMatchObject({
      attemptId: "auth_attempt_1",
      userCode: "ABCD-EFGH",
    });

    await expect(
      completeSentryDeveloperConnectionAuth(ctx(), {
        provider: "sentry",
        attemptId: "auth_attempt_1",
      })
    ).resolves.toEqual({ provider: "sentry", status: "connected" });

    expect(encryptMock).toHaveBeenCalledWith(
      JSON.stringify({ token: "sentry-oauth-token" }),
      envMock.ENCRYPTION_KEY
    );
    expect(replaceCurrentDeveloperConnectionMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        credentialKind: "sentry_oauth_token",
        provider: "sentry",
        providerAccountName: "lightfast/app",
      })
    );
  });

  it("toggles sandbox enablement through the db helper", async () => {
    setCurrentDeveloperConnectionSandboxEnabledMock.mockResolvedValue({
      provider: "sentry",
      enabledForSandboxes: false,
    });

    await expect(
      setDeveloperConnectionSandboxEnabled(ctx(), {
        provider: "sentry",
        enabled: false,
      })
    ).resolves.toEqual({ enabled: false });
  });

  it("disconnects through the db helper", async () => {
    revokeCurrentDeveloperConnectionMock.mockResolvedValue({
      provider: "sentry",
      status: "revoked",
    });

    await expect(
      disconnectDeveloperConnection(ctx(), { provider: "sentry" })
    ).resolves.toEqual({ disconnected: true });
  });

  it("issues leases only for requested enabled providers", async () => {
    listCurrentDeveloperConnectionsMock.mockResolvedValue([
      {
        id: 1,
        publicId: "developer_connection_1",
        clerkOrgId: "org_acme",
        provider: "sentry",
        providerAccountId: "org:lightfast",
        providerAccountName: "lightfast/app",
        status: "connected",
        enabledForSandboxes: true,
        credentialKind: "sentry_token",
        credentialSchemaVersion: "1",
        encryptedCredential: 'encrypted:{"token":"sentry-token"}',
        scopes: ["project:read"],
        metadata: {},
        expiresAt: null,
        lastVerifiedAt: new Date("2026-06-03T00:00:00.000Z"),
        lastUsedAt: null,
        lastUsedByUserId: null,
        createdByUserId: "user_admin",
        updatedByUserId: "user_admin",
        createdAt: new Date("2026-06-03T00:00:00.000Z"),
        updatedAt: new Date("2026-06-03T00:00:00.000Z"),
        revokedAt: null,
      },
    ]);

    await expect(
      issueDeveloperConnectionLeases(ctx(), {
        providers: ["sentry"],
        sandboxRunId: "sandbox_run_1",
        workflowRunId: "workflow_run_1",
      })
    ).resolves.toEqual({
      leases: [
        expect.objectContaining({
          provider: "sentry",
          status: "issued",
        }),
      ],
      materialization: [
        expect.objectContaining({
          provider: "sentry",
          env: { SENTRY_AUTH_TOKEN: "sentry-token" },
        }),
      ],
    });
  });
});

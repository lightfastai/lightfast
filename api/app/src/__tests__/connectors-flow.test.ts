import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Database, OrgConnectorConnection } from "@db/app";

const clerkGetOrganizationMembershipListMock = vi.fn();
const authMock = vi.fn();
const nanoidMock = vi.fn();
const redisGetMock = vi.fn();
const redisGetdelMock = vi.fn();
const redisSetMock = vi.fn();
const getCurrentOrgConnectorConnectionMock = vi.fn();
const listCurrentOrgConnectorConnectionsMock = vi.fn();
const finalizeCurrentOrgConnectorConnectionMock = vi.fn();
const markCurrentOrgConnectorConnectionRevokedMock = vi.fn();
const markCurrentOrgConnectorConnectionErrorMock = vi.fn();
const updateConnectorToolManifestMock = vi.fn();
const recordConnectorToolRefreshErrorMock = vi.fn();
const setConnectorAutomationEnabledDbMock = vi.fn();
const updateObservedConnectorTokensMock = vi.fn();
const createLinearPkcePairMock = vi.fn();
const exchangeLinearOAuthCodeMock = vi.fn();
const getLinearViewerMetadataMock = vi.fn();
const listLinearMcpToolsMock = vi.fn();
const refreshLinearOAuthTokenMock = vi.fn();
const revokeLinearOAuthTokenMock = vi.fn();
const encryptMock = vi.fn();
const decryptMock = vi.fn();
const logWarnMock = vi.fn();

const envMock = {
  ENCRYPTION_KEY:
    "0000000000000000000000000000000000000000000000000000000000000000",
  LINEAR_API_ORIGIN: "https://linear.test",
  LINEAR_CLIENT_ID: "linear_client_test",
  LINEAR_CLIENT_SECRET: "linear_secret_test",
  LINEAR_MCP_ENDPOINT: "https://linear.test/mcp",
  NEXT_PUBLIC_APP_URL: "https://app.lightfast.localhost",
  VERCEL_ENV: "development",
};

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  finalizeCurrentOrgConnectorConnection: finalizeCurrentOrgConnectorConnectionMock,
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  listCurrentOrgConnectorConnections: listCurrentOrgConnectorConnectionsMock,
  markCurrentOrgConnectorConnectionError: markCurrentOrgConnectorConnectionErrorMock,
  markCurrentOrgConnectorConnectionRevoked:
    markCurrentOrgConnectorConnectionRevokedMock,
  recordConnectorToolRefreshError: recordConnectorToolRefreshErrorMock,
  setConnectorAutomationEnabled: setConnectorAutomationEnabledDbMock,
  updateConnectorToolManifest: updateConnectorToolManifestMock,
  updateObservedConnectorTokens: updateObservedConnectorTokensMock,
}));

vi.mock("@repo/app-encryption", () => ({
  decrypt: decryptMock,
  encrypt: encryptMock,
}));

vi.mock("@repo/linear-app-node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/linear-app-node")>();
  return {
    ...actual,
    createLinearPkcePair: createLinearPkcePairMock,
    exchangeLinearOAuthCode: exchangeLinearOAuthCodeMock,
    getLinearViewerMetadata: getLinearViewerMetadataMock,
    listLinearMcpTools: listLinearMcpToolsMock,
    refreshLinearOAuthToken: refreshLinearOAuthTokenMock,
    revokeLinearOAuthToken: revokeLinearOAuthTokenMock,
  };
});

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
  clerkClient: () =>
    Promise.resolve({
      users: {
        getOrganizationMembershipList: clerkGetOrganizationMembershipListMock,
      },
    }),
}));

vi.mock("@vendor/lib", () => ({
  nanoid: nanoidMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: { error: vi.fn(), info: vi.fn(), warn: logWarnMock },
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    get: redisGetMock,
    getdel: redisGetdelMock,
    set: redisSetMock,
  },
}));

vi.mock("../env", () => ({ env: envMock }));

const { LinearAppNodeError } = await import("@repo/linear-app-node");
const {
  assertCurrentSessionCanFinalizeConnectorOAuth,
  ConnectorOAuthFinalizeAccessError,
} = await import("../services/connectors/auth");
const {
  consumeLinearConnectOAuthAttempt,
  issueLinearConnectOAuthAttempt,
} = await import("../services/connectors/attempts");
const {
  completeLinearConnectorOAuth,
  disconnectLinearConnector,
  refreshLinearConnectorTools,
  startLinearConnectorOAuth,
} = await import("../services/connectors/linear-flow");
const { listConnectorsForOrg } = await import("../services/connectors/catalog");

function ctx(input: { isAdmin?: boolean } = {}) {
  return {
    auth: {
      access: {
        has: ({ role }: { role?: string }) =>
          (input.isAdmin ?? true) ? role === "org:admin" : false,
        kind: "clerk-session" as const,
        orgId: "org_acme",
        userId: "user_current",
      },
      identity: {
        orgGate: {
          bindingStatus: "bound" as const,
          nextSetupRequirement: null,
        },
        orgId: "org_acme",
        type: "active" as const,
        userId: "user_current",
      },
    },
    db: {} as Database,
    headers: new Headers(),
  };
}

function connection(
  overrides: Partial<OrgConnectorConnection> = {}
): OrgConnectorConnection {
  return {
    accessTokenExpiresAt: new Date("2099-06-01T08:00:00.000Z"),
    clerkOrgId: "org_acme",
    connectedAt: new Date("2026-06-01T00:00:00.000Z"),
    connectedByUserId: "user_current",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    enabledForAutomations: true,
    id: 1,
    lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
    lastToolRefreshErrorAt: null,
    lastToolRefreshErrorCode: null,
    mcpEndpoint: "https://linear.test/mcp",
    metadata: {},
    provider: "linear",
    providerActorId: "actor_1",
    providerActorName: "Jeevan",
    providerWorkspaceId: "workspace_1",
    providerWorkspaceName: "Acme",
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    revokedAt: null,
    scopes: ["read", "write"],
    status: "active",
    toolManifest: [
      { description: "Create issue", name: "create_issue" },
      { description: "Unsupported", name: "Create Issue" },
    ],
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function membership(role = "org:admin") {
  return {
    organization: {
      id: "org_acme",
      name: "Acme",
      slug: "acme",
    },
    role,
  };
}

describe("connector catalog services", () => {
  beforeEach(() => {
    listCurrentOrgConnectorConnectionsMock.mockReset();
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([]);
  });

  it("lists catalog rows with management, availability, missing config, and display-safe tools", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({ enabledForAutomations: true }),
    ]);

    const rows = await listConnectorsForOrg(ctx());

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          availableForAutomations: true,
          canManage: true,
          catalogStatus: "available",
          connectAvailability: { status: "available" },
          connection: expect.objectContaining({
            status: "active",
            tools: [
              {
                availableForAutomations: true,
                description: "Create issue",
                name: "create_issue",
              },
              {
                availableForAutomations: false,
                description: "Unsupported",
                name: "Create Issue",
              },
            ],
          }),
          provider: "linear",
        }),
        expect.objectContaining({
          availableForAutomations: false,
          catalogStatus: "coming_soon",
          connectAvailability: {
            reason: "coming_soon",
            status: "unavailable",
          },
          connection: null,
          provider: "slack",
        }),
      ])
    );

    envMock.LINEAR_CLIENT_SECRET = undefined as unknown as string;
    const missingConfigRows = await listConnectorsForOrg(ctx());
    expect(
      missingConfigRows.find((row) => row.provider === "linear")
    ).toMatchObject({
      connectAvailability: {
        missing: ["LINEAR_CLIENT_SECRET"],
        reason: "missing_config",
        status: "unavailable",
      },
    });
  });
});

describe("connector OAuth attempts", () => {
  beforeEach(() => {
    nanoidMock.mockReset();
    redisGetMock.mockReset();
    redisGetdelMock.mockReset();
    redisSetMock.mockReset();
    nanoidMock.mockReturnValue("attempt_123456789012345678901234");
  });

  it("issues one-time Linear OAuth attempts with hashed state", async () => {
    const issued = await issueLinearConnectOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
    });
    const record = redisSetMock.mock.calls[0]?.[1];

    expect(record).toEqual({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(record)).not.toContain(issued.state);
    expect(redisSetMock).toHaveBeenCalledWith(
      "linear-connect-oauth-attempt:attempt_123456789012345678901234",
      record,
      { ex: 900 }
    );

    redisGetMock.mockResolvedValueOnce(record);
    redisGetdelMock.mockResolvedValueOnce(record);

    await expect(
      consumeLinearConnectOAuthAttempt({ state: issued.state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_acme",
      lightfastUserId: "user_current",
      mode: "connect",
    });

    redisGetMock.mockResolvedValueOnce(record);
    redisGetdelMock.mockResolvedValueOnce(null);

    await expect(
      consumeLinearConnectOAuthAttempt({ state: issued.state })
    ).resolves.toBeNull();
  });
});

describe("connector callback auth helper", () => {
  beforeEach(() => {
    authMock.mockReset();
    clerkGetOrganizationMembershipListMock.mockReset();
    authMock.mockResolvedValue({
      orgId: "org_acme",
      userId: "user_current",
    });
    clerkGetOrganizationMembershipListMock.mockResolvedValue({
      data: [membership()],
      totalCount: 1,
    });
  });

  it.each([
    ["unauthenticated", { userId: null }, "UNAUTHENTICATED"],
    ["wrong user", { orgId: "org_acme", userId: "user_other" }, "EXPECTED_USER_MISMATCH"],
    ["wrong active org", { orgId: "org_other", userId: "user_current" }, "ACTIVE_ORG_MISMATCH"],
  ] as const)("rejects %s callbacks", async (_name, session, code) => {
    authMock.mockResolvedValueOnce(session);

    await expect(
      assertCurrentSessionCanFinalizeConnectorOAuth({
        clerkOrgId: "org_acme",
        expectedUserId: "user_current",
      })
    ).rejects.toMatchObject({ code });
  });

  it("rejects missing membership and non-admin members", async () => {
    clerkGetOrganizationMembershipListMock.mockResolvedValueOnce({
      data: [],
      totalCount: 0,
    });

    await expect(
      assertCurrentSessionCanFinalizeConnectorOAuth({
        clerkOrgId: "org_acme",
        expectedUserId: "user_current",
      })
    ).rejects.toMatchObject({ code: "MISSING_MEMBERSHIP" });

    clerkGetOrganizationMembershipListMock.mockResolvedValueOnce({
      data: [membership("org:member")],
      totalCount: 1,
    });

    await expect(
      assertCurrentSessionCanFinalizeConnectorOAuth({
        clerkOrgId: "org_acme",
        expectedUserId: "user_current",
      })
    ).rejects.toMatchObject({ code: "NON_ADMIN" });
  });

  it("accepts matching admin callbacks", async () => {
    await expect(
      assertCurrentSessionCanFinalizeConnectorOAuth({
        clerkOrgId: "org_acme",
        expectedUserId: "user_current",
      })
    ).resolves.toEqual({ userId: "user_current" });
  });
});

describe("Linear connector flow", () => {
  beforeEach(() => {
    envMock.LINEAR_API_ORIGIN = "https://linear.test";
    envMock.LINEAR_CLIENT_ID = "linear_client_test";
    envMock.LINEAR_CLIENT_SECRET = "linear_secret_test";
    envMock.LINEAR_MCP_ENDPOINT = "https://linear.test/mcp";
    process.env.NEXT_PUBLIC_APP_URL = "https://app.lightfast.localhost";

    clerkGetOrganizationMembershipListMock.mockReset();
    decryptMock.mockReset();
    encryptMock.mockReset();
    exchangeLinearOAuthCodeMock.mockReset();
    finalizeCurrentOrgConnectorConnectionMock.mockReset();
    getCurrentOrgConnectorConnectionMock.mockReset();
    getLinearViewerMetadataMock.mockReset();
    listLinearMcpToolsMock.mockReset();
    logWarnMock.mockReset();
    markCurrentOrgConnectorConnectionErrorMock.mockReset();
    markCurrentOrgConnectorConnectionRevokedMock.mockReset();
    recordConnectorToolRefreshErrorMock.mockReset();
    refreshLinearOAuthTokenMock.mockReset();
    revokeLinearOAuthTokenMock.mockReset();
    updateConnectorToolManifestMock.mockReset();
    updateObservedConnectorTokensMock.mockReset();
    createLinearPkcePairMock.mockReset();
    nanoidMock.mockReset();
    redisSetMock.mockReset();

    clerkGetOrganizationMembershipListMock.mockResolvedValue({
      data: [membership()],
      totalCount: 1,
    });
    createLinearPkcePairMock.mockReturnValue({
      codeChallenge: "challenge_123",
      codeChallengeMethod: "S256",
      codeVerifier: "verifier_123",
    });
    nanoidMock.mockReturnValue("attempt_123456789012345678901234");
    markCurrentOrgConnectorConnectionRevokedMock.mockResolvedValue(
      connection({ status: "revoked" })
    );
    encryptMock.mockImplementation(async (value: string) => `encrypted:${value}`);
    decryptMock.mockImplementation(async (value: string) =>
      value === "encrypted_access"
        ? "access_token"
        : value === "encrypted_access_new"
          ? "access_token_new"
          : value === "encrypted_refresh_new"
            ? "refresh_token_new"
            : "refresh_token"
    );
  });

  it("starts connect or reconnect based on the current Linear connection", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(undefined);

    const connectResult = await startLinearConnectorOAuth(ctx());
    expect(connectResult).toMatchObject({
      authorizationUrl: expect.stringContaining(
        "https://linear.test/oauth/authorize"
      ),
      mode: "connect",
    });
    const connectUrl = new URL(connectResult.authorizationUrl);
    expect(connectUrl.searchParams.get("redirect_uri")).toBe(
      "https://app.lightfast.localhost/api/connectors/linear/oauth/callback"
    );

    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(connection());

    await expect(startLinearConnectorOAuth(ctx())).resolves.toMatchObject({
      authorizationUrl: expect.stringContaining("state="),
      mode: "reconnect",
    });

    expect(redisSetMock).toHaveBeenLastCalledWith(
      "linear-connect-oauth-attempt:attempt_123456789012345678901234",
      expect.objectContaining({ mode: "reconnect" }),
      { ex: 900 }
    );
  });

  it("throws a typed tRPC error when Linear config is missing", async () => {
    envMock.LINEAR_CLIENT_SECRET = undefined as unknown as string;

    await expect(startLinearConnectorOAuth(ctx())).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Linear connector is not configured.",
    });
  });

  it("completes OAuth with the public oauth callback path", async () => {
    const issued = await issueLinearConnectOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
    });
    const attemptRecord = redisSetMock.mock.calls[0]?.[1];
    redisGetMock
      .mockResolvedValueOnce(attemptRecord)
      .mockResolvedValueOnce(attemptRecord);
    redisGetdelMock.mockResolvedValueOnce(attemptRecord);
    authMock.mockResolvedValue({ orgId: "org_acme", userId: "user_current" });
    exchangeLinearOAuthCodeMock.mockResolvedValue({
      accessToken: "linear_access_token",
      accessTokenExpiresIn: 3600,
      refreshToken: "linear_refresh_token",
      refreshTokenExpiresIn: 86_400,
      scopes: ["read", "write"],
      tokenType: "Bearer",
    });
    getLinearViewerMetadataMock.mockResolvedValue({
      actorId: "actor_1",
      actorName: "Jeevan",
      workspaceId: "workspace_1",
      workspaceName: "Acme",
    });
    listLinearMcpToolsMock.mockResolvedValue([{ name: "create_issue" }]);
    finalizeCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());

    await expect(
      completeLinearConnectorOAuth({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl: `https://app.lightfast.localhost/api/connectors/linear/oauth/callback?code=code_123&state=${issued.state}`,
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/connectors?connector=linear",
    });

    expect(exchangeLinearOAuthCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/linear/oauth/callback",
      })
    );
  });

  it("revokes the previous current Linear tokens before replacing them on reconnect", async () => {
    const issued = await issueLinearConnectOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "reconnect",
      orgSlug: "acme",
    });
    const attemptRecord = redisSetMock.mock.calls[0]?.[1];
    redisGetMock
      .mockResolvedValueOnce(attemptRecord)
      .mockResolvedValueOnce(attemptRecord);
    redisGetdelMock.mockResolvedValueOnce(attemptRecord);
    authMock.mockResolvedValue({ orgId: "org_acme", userId: "user_current" });
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    exchangeLinearOAuthCodeMock.mockResolvedValue({
      accessToken: "linear_access_token",
      accessTokenExpiresIn: 3600,
      refreshToken: "linear_refresh_token",
      refreshTokenExpiresIn: 86_400,
      scopes: ["read", "write"],
      tokenType: "Bearer",
    });
    getLinearViewerMetadataMock.mockResolvedValue({
      actorId: "actor_1",
      actorName: "Jeevan",
      workspaceId: "workspace_1",
      workspaceName: "Acme",
    });
    listLinearMcpToolsMock.mockResolvedValue([{ name: "create_issue" }]);
    revokeLinearOAuthTokenMock.mockRejectedValue(
      new LinearAppNodeError("LINEAR_REVOKE_FAILED", "revoke failed")
    );
    finalizeCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());

    await expect(
      completeLinearConnectorOAuth({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl: `https://app.lightfast.localhost/api/connectors/linear/oauth/callback?code=code_123&state=${issued.state}`,
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/connectors?connector=linear",
    });

    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledTimes(2);
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "access_token" })
    );
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "refresh_token" })
    );
    expect(finalizeCurrentOrgConnectorConnectionMock).toHaveBeenCalled();
    expect(finalizeCurrentOrgConnectorConnectionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        observedCurrentConnectionId: 1,
        observedEncryptedAccessToken: "encrypted_access",
        observedEncryptedRefreshToken: "encrypted_refresh",
      })
    );
    const lastRevokeOrder =
      revokeLinearOAuthTokenMock.mock.invocationCallOrder[
        revokeLinearOAuthTokenMock.mock.invocationCallOrder.length - 1
      ];
    const finalizeOrder =
      finalizeCurrentOrgConnectorConnectionMock.mock.invocationCallOrder[0];
    if (lastRevokeOrder === undefined || finalizeOrder === undefined) {
      throw new Error("Expected revoke and finalize calls to be recorded.");
    }
    expect(lastRevokeOrder).toBeLessThan(finalizeOrder);
    expect(logWarnMock).toHaveBeenCalledWith(
      "[connectors] linear revoke failed during reconnect",
      expect.objectContaining({
        failure: expect.objectContaining({
          code: "LINEAR_REVOKE_FAILED",
          name: "LinearAppNodeError",
        }),
        provider: "linear",
      })
    );
    for (const call of logWarnMock.mock.calls) {
      expect(JSON.stringify(call[1])).not.toContain("access_token");
      expect(JSON.stringify(call[1])).not.toContain("refresh_token");
    }
  });

  it("revokes issued tokens when post-exchange Linear discovery fails", async () => {
    const issued = await issueLinearConnectOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
    });
    const attemptRecord = redisSetMock.mock.calls[0]?.[1];
    redisGetMock
      .mockResolvedValueOnce(attemptRecord)
      .mockResolvedValueOnce(attemptRecord);
    redisGetdelMock.mockResolvedValueOnce(attemptRecord);
    authMock.mockResolvedValue({ orgId: "org_acme", userId: "user_current" });
    exchangeLinearOAuthCodeMock.mockResolvedValue({
      accessToken: "linear_access_token",
      accessTokenExpiresIn: 3600,
      refreshToken: "linear_refresh_token",
      refreshTokenExpiresIn: 86_400,
      scopes: ["read", "write"],
      tokenType: "Bearer",
    });
    getLinearViewerMetadataMock.mockRejectedValue(
      new LinearAppNodeError(
        "LINEAR_METADATA_FAILED",
        "Linear metadata request failed."
      )
    );
    listLinearMcpToolsMock.mockResolvedValue([{ name: "create_issue" }]);
    revokeLinearOAuthTokenMock.mockRejectedValue(
      new LinearAppNodeError("LINEAR_REVOKE_FAILED", "revoke failed")
    );

    await expect(
      completeLinearConnectorOAuth({
        appOrigin: "https://app.lightfast.localhost",
        requestUrl: `https://app.lightfast.localhost/api/connectors/linear/oauth/callback?code=code_123&state=${issued.state}`,
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/connectors?connector=linear&error=linear_transient_error",
    });

    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledTimes(2);
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "linear_client_test",
        clientSecret: "linear_secret_test",
        token: "linear_access_token",
      })
    );
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "linear_client_test",
        clientSecret: "linear_secret_test",
        token: "linear_refresh_token",
      })
    );
    expect(finalizeCurrentOrgConnectorConnectionMock).not.toHaveBeenCalled();
    expect(logWarnMock).toHaveBeenCalledWith(
      "[connectors] linear dropped token revoke failed",
      expect.objectContaining({
        failure: expect.objectContaining({
          code: "LINEAR_REVOKE_FAILED",
          name: "LinearAppNodeError",
        }),
        reason: "post_exchange_failure",
      })
    );
    for (const call of logWarnMock.mock.calls) {
      expect(call[1]).not.toHaveProperty("error");
    }
  });

  it("preserves the previous tool manifest on non-auth discovery failure", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    listLinearMcpToolsMock.mockRejectedValue(
      new LinearAppNodeError(
        "LINEAR_MCP_FAILED",
        "Linear MCP tool listing failed."
      )
    );

    await expect(refreshLinearConnectorTools(ctx())).resolves.toEqual({
      refreshed: false,
      status: "refresh_error",
    });

    expect(recordConnectorToolRefreshErrorMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clerkOrgId: "org_acme",
        lastToolRefreshErrorCode: "LINEAR_MCP_FAILED",
        provider: "linear",
      })
    );
    expect(updateConnectorToolManifestMock).not.toHaveBeenCalled();
    expect(markCurrentOrgConnectorConnectionErrorMock).not.toHaveBeenCalled();
  });

  it("does not disable automations when a concurrent token refresh wins first", async () => {
    getCurrentOrgConnectorConnectionMock
      .mockResolvedValueOnce(
        connection({
          accessTokenExpiresAt: new Date("2026-06-01T00:00:00.000Z"),
          encryptedAccessToken: "encrypted_access",
          encryptedRefreshToken: "encrypted_refresh",
        })
      )
      .mockResolvedValueOnce(
        connection({
          accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
          encryptedAccessToken: "encrypted_access_new",
          encryptedRefreshToken: "encrypted_refresh_new",
        })
      );
    refreshLinearOAuthTokenMock.mockRejectedValue(
      new LinearAppNodeError(
        "LINEAR_TOKEN_REFRESH_FAILED",
        "Linear OAuth token refresh failed."
      )
    );
    listLinearMcpToolsMock.mockResolvedValue([{ name: "create_issue" }]);

    await expect(refreshLinearConnectorTools(ctx())).resolves.toEqual({
      refreshed: true,
      status: "ok",
      toolManifest: [{ name: "create_issue" }],
    });

    expect(listLinearMcpToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "access_token_new" })
    );
    expect(updateConnectorToolManifestMock).toHaveBeenCalled();
    expect(markCurrentOrgConnectorConnectionErrorMock).not.toHaveBeenCalled();
  });

  it("uses the persisted winner token when observed token update loses a race", async () => {
    getCurrentOrgConnectorConnectionMock
      .mockResolvedValueOnce(
        connection({
          accessTokenExpiresAt: new Date("2026-06-01T00:00:00.000Z"),
          encryptedAccessToken: "encrypted_access",
          encryptedRefreshToken: "encrypted_refresh",
        })
      )
      .mockResolvedValueOnce(
        connection({
          accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
          encryptedAccessToken: "encrypted_access_new",
          encryptedRefreshToken: "encrypted_refresh_new",
        })
      );
    refreshLinearOAuthTokenMock.mockResolvedValue({
      accessToken: "linear_access_loser",
      accessTokenExpiresIn: 3600,
      refreshToken: "linear_refresh_loser",
      refreshTokenExpiresIn: 86_400,
      scopes: ["read", "write"],
      tokenType: "Bearer",
    });
    updateObservedConnectorTokensMock.mockResolvedValue(false);
    listLinearMcpToolsMock.mockResolvedValue([{ name: "create_issue" }]);

    await expect(refreshLinearConnectorTools(ctx())).resolves.toEqual({
      refreshed: true,
      status: "ok",
      toolManifest: [{ name: "create_issue" }],
    });

    expect(listLinearMcpToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: "access_token_new" })
    );
    expect(updateObservedConnectorTokensMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        observedEncryptedAccessToken: "encrypted_access",
        observedEncryptedRefreshToken: "encrypted_refresh",
      })
    );
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledTimes(2);
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "linear_access_loser" })
    );
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "linear_refresh_loser" })
    );
    expect(markCurrentOrgConnectorConnectionErrorMock).not.toHaveBeenCalled();
  });

  it("does not revoke the stored refresh token when a lost refresh carries it forward", async () => {
    getCurrentOrgConnectorConnectionMock
      .mockResolvedValueOnce(
        connection({
          accessTokenExpiresAt: new Date("2000-01-01T00:00:00.000Z"),
          encryptedAccessToken: "encrypted_access",
          encryptedRefreshToken: "encrypted_refresh",
        })
      )
      .mockResolvedValueOnce(
        connection({
          accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
          encryptedAccessToken: "encrypted_access_new",
          encryptedRefreshToken: "encrypted_refresh",
        })
      );
    refreshLinearOAuthTokenMock.mockResolvedValue({
      accessToken: "linear_access_loser",
      accessTokenExpiresIn: 3600,
      refreshToken: "refresh_token",
      refreshTokenExpiresIn: 86_400,
      scopes: ["read", "write"],
      tokenType: "Bearer",
    });
    updateObservedConnectorTokensMock.mockResolvedValue(false);
    listLinearMcpToolsMock.mockResolvedValue([{ name: "create_issue" }]);

    await expect(refreshLinearConnectorTools(ctx())).resolves.toEqual({
      refreshed: true,
      status: "ok",
      toolManifest: [{ name: "create_issue" }],
    });

    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledTimes(1);
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "linear_access_loser" })
    );
    expect(revokeLinearOAuthTokenMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ token: "refresh_token" })
    );
    expect(markCurrentOrgConnectorConnectionErrorMock).not.toHaveBeenCalled();
  });

  it("marks an expired Linear connection without a refresh token as auth error", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({
        accessTokenExpiresAt: new Date("2000-01-01T00:00:00.000Z"),
        encryptedRefreshToken: null,
      })
    );

    await expect(refreshLinearConnectorTools(ctx())).resolves.toEqual({
      refreshed: false,
      status: "auth_error",
    });

    expect(markCurrentOrgConnectorConnectionErrorMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        provider: "linear",
      }
    );
    expect(listLinearMcpToolsMock).not.toHaveBeenCalled();
  });

  it("wipes local tokens and manifest even when provider revoke fails", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    revokeLinearOAuthTokenMock.mockRejectedValue(
      new LinearAppNodeError("LINEAR_REVOKE_FAILED", "revoke failed")
    );

    await expect(disconnectLinearConnector(ctx())).resolves.toEqual({
      disconnected: true,
    });

    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledTimes(2);
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "access_token" })
    );
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "refresh_token" })
    );
    expect(markCurrentOrgConnectorConnectionRevokedMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        observedCurrentConnectionId: 1,
        observedEncryptedAccessToken: "encrypted_access",
        observedEncryptedRefreshToken: "encrypted_refresh",
        provider: "linear",
      }
    );
    expect(logWarnMock).toHaveBeenCalledWith(
      "[connectors] linear revoke failed during disconnect",
      expect.objectContaining({
        failure: expect.objectContaining({
          code: "LINEAR_REVOKE_FAILED",
          name: "LinearAppNodeError",
        }),
        provider: "linear",
      })
    );
    expect(logWarnMock.mock.calls[0]?.[1]).not.toHaveProperty("error");
  });

  it("dedupes identical Linear tokens during disconnect revoke", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    decryptMock.mockImplementation(async (value: string) =>
      value === "encrypted_access" || value === "encrypted_refresh"
        ? "shared_token"
        : "other_token"
    );

    await expect(disconnectLinearConnector(ctx())).resolves.toEqual({
      disconnected: true,
    });

    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledTimes(1);
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "shared_token" })
    );
    expect(markCurrentOrgConnectorConnectionRevokedMock).toHaveBeenCalled();
  });

  it("retries disconnect when the observed current connection changes before local revoke", async () => {
    getCurrentOrgConnectorConnectionMock
      .mockResolvedValueOnce(connection({ id: 1 }))
      .mockResolvedValueOnce(
        connection({
          id: 2,
          encryptedAccessToken: "encrypted_access_new",
          encryptedRefreshToken: "encrypted_refresh_new",
        })
      );
    markCurrentOrgConnectorConnectionRevokedMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(connection({ id: 2, status: "revoked" }));

    await expect(disconnectLinearConnector(ctx())).resolves.toEqual({
      disconnected: true,
    });

    expect(markCurrentOrgConnectorConnectionRevokedMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        observedCurrentConnectionId: 1,
        observedEncryptedAccessToken: "encrypted_access",
        observedEncryptedRefreshToken: "encrypted_refresh",
        provider: "linear",
      }
    );
    expect(markCurrentOrgConnectorConnectionRevokedMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        observedCurrentConnectionId: 2,
        observedEncryptedAccessToken: "encrypted_access_new",
        observedEncryptedRefreshToken: "encrypted_refresh_new",
        provider: "linear",
      }
    );
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "access_token" })
    );
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "refresh_token" })
    );
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "access_token_new" })
    );
    expect(revokeLinearOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "refresh_token_new" })
    );
  });
});

import { createHash } from "node:crypto";
import type { Database, OrgConnectorConnection } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
const updateConnectorToolManifestAndAutomationStateMock = vi.fn();
const updateConnectorToolManifestMock = vi.fn();
const recordConnectorToolRefreshErrorMock = vi.fn();
const setConnectorAutomationEnabledDbMock = vi.fn();
const setConnectorAgentEnabledDbMock = vi.fn();
const updateObservedConnectorTokensMock = vi.fn();
const createLinearPkcePairMock = vi.fn();
const exchangeLinearOAuthCodeMock = vi.fn();
const getLinearViewerMetadataMock = vi.fn();
const listLinearMcpToolsMock = vi.fn();
const refreshLinearOAuthTokenMock = vi.fn();
const revokeLinearOAuthTokenMock = vi.fn();
const createXPkcePairMock = vi.fn();
const exchangeXOAuthCodeMock = vi.fn();
const getXViewerMetadataMock = vi.fn();
const listXBridgeMcpToolsMock = vi.fn();
const refreshXOAuthTokenMock = vi.fn();
const revokeXOAuthTokenMock = vi.fn();
const encryptMock = vi.fn();
const decryptMock = vi.fn();
const logWarnMock = vi.fn();

const envMock = {
  CONNECTOR_MCP_AUTH_SECRET: "mcp_auth_secret_12345678901234567890",
  ENCRYPTION_KEY:
    "0000000000000000000000000000000000000000000000000000000000000000",
  LINEAR_API_ORIGIN: "https://linear.test",
  LINEAR_CLIENT_ID: "linear_client_test",
  LINEAR_CLIENT_SECRET: "linear_secret_test",
  LINEAR_MCP_ENDPOINT: "https://linear.test/mcp",
  VITE_LIGHTFAST_APP_URL: "https://app.lightfast.localhost",
  VERCEL_ENV: "development",
  X_API_ORIGIN: "https://x.test",
  X_CLIENT_ID: "x_client_test",
  X_CLIENT_SECRET: "x_secret_test",
  X_MCP_ENDPOINT: "https://app.lightfast.localhost/api/connectors/x/mcp",
  X_OAUTH_ORIGIN: "https://x.test",
};

const testXConnectorOAuthRedirectPaths = {
  accountTeams: () => "/account/teams",
  connectorPage: ({ orgSlug }: { orgSlug: string }) => `/${orgSlug}/connectors`,
  setupComplete: ({ orgSlug }: { orgSlug: string }) =>
    `/${orgSlug}/tasks/connectors/x/complete`,
  signIn: () => "/sign-in",
};

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  finalizeCurrentOrgConnectorConnection:
    finalizeCurrentOrgConnectorConnectionMock,
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  listCurrentOrgConnectorConnections: listCurrentOrgConnectorConnectionsMock,
  markCurrentOrgConnectorConnectionError:
    markCurrentOrgConnectorConnectionErrorMock,
  markCurrentOrgConnectorConnectionRevoked:
    markCurrentOrgConnectorConnectionRevokedMock,
  recordConnectorToolRefreshError: recordConnectorToolRefreshErrorMock,
  setConnectorAgentEnabled: setConnectorAgentEnabledDbMock,
  setConnectorAutomationEnabled: setConnectorAutomationEnabledDbMock,
  updateConnectorToolManifestAndAutomationState:
    updateConnectorToolManifestAndAutomationStateMock,
  updateConnectorToolManifest: updateConnectorToolManifestMock,
  updateObservedConnectorTokens: updateObservedConnectorTokensMock,
}));

vi.mock("@repo/app-encryption", () => ({
  decrypt: decryptMock,
  encrypt: encryptMock,
}));

vi.mock("@lightfast/connector-linear/mcp", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@lightfast/connector-linear/mcp")>();
  return {
    ...actual,
    listLinearMcpTools: listLinearMcpToolsMock,
  };
});

vi.mock("@lightfast/connector-linear/node", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@lightfast/connector-linear/node")>();
  return {
    ...actual,
    getLinearViewerMetadata: getLinearViewerMetadataMock,
  };
});

vi.mock("@lightfast/connector-linear/oauth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@lightfast/connector-linear/oauth")>();
  return {
    ...actual,
    createLinearPkcePair: createLinearPkcePairMock,
    exchangeLinearOAuthCode: exchangeLinearOAuthCodeMock,
    refreshLinearOAuthToken: refreshLinearOAuthTokenMock,
    revokeLinearOAuthToken: revokeLinearOAuthTokenMock,
  };
});

vi.mock("@lightfast/connector-x/mcp", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@lightfast/connector-x/mcp")>();
  return {
    ...actual,
    listXBridgeMcpTools: listXBridgeMcpToolsMock,
  };
});

vi.mock("@lightfast/connector-x/node", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@lightfast/connector-x/node")>();
  return {
    ...actual,
    getXViewerMetadata: getXViewerMetadataMock,
  };
});

vi.mock("@lightfast/connector-x/oauth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@lightfast/connector-x/oauth")>();
  return {
    ...actual,
    createXPkcePair: createXPkcePairMock,
    exchangeXOAuthCode: exchangeXOAuthCodeMock,
    refreshXOAuthToken: refreshXOAuthTokenMock,
    revokeXOAuthToken: revokeXOAuthTokenMock,
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

const { LinearAppNodeError } = await import("@lightfast/connector-linear/node");
const { XAppNodeError } = await import("@lightfast/connector-x/node");
const { X_OAUTH_SCOPE } = await import("@lightfast/connector-x/oauth");
const { assertCurrentSessionCanFinalizeConnectorOAuth } = await import(
  "../services/connectors/auth"
);
const {
  getLinearConnectorConfig,
  getXConnectorConfig,
  parseLinearConnectorConfig,
} = await import("../services/connectors/config");
const {
  consumeConnectorOAuthAttempt,
  issueConnectorOAuthAttempt,
  lookupConnectorOAuthAttempt,
} = await import("../services/connectors/attempts");
const { verifyConnectorMcpToken } = await import(
  "../services/connectors/mcp-auth"
);
const {
  completeLinearConnectorOAuth,
  disconnectLinearConnector,
  refreshLinearConnectorTools,
  startLinearConnectorOAuth,
} = await import("../services/connectors/linear-flow");
const linearFlow = (await import("../services/connectors/linear-flow")) as {
  setLinearConnectorAgentEnabled?: (
    context: ReturnType<typeof ctx>,
    input: { enabled: boolean }
  ) => Promise<{ enabled: boolean }>;
};
const {
  completeXConnectorOAuth,
  disconnectXConnector,
  refreshXConnectorTools,
  startXConnectorOAuth,
} = await import("../services/connectors/x-flow");
const {
  disconnectConnector,
  refreshConnectorTools,
  setConnectorAgentEnabled,
  setConnectorAutomationEnabled,
  startConnectorOAuth,
} = await import("../services/connectors");
const { listConnectorsForOrg } = await import("../services/connectors/catalog");

function ctx() {
  return {
    actor: { userId: "user_current" },
    db: {} as Database,
    organization: { orgId: "org_acme" },
  };
}

function catalogCtx(input: { canManage?: boolean } = {}) {
  return {
    db: {} as Database,
    organization: { orgId: "org_acme" },
    viewer: { canManage: input.canManage ?? true },
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
    enabledForAgents: false,
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

async function expectLastXBridgeListTokenPurpose(purpose: "discover" | "list") {
  const call = listXBridgeMcpToolsMock.mock.calls.at(-1)?.[0] as
    | { mcpToken: string }
    | undefined;

  expect(call).toEqual(
    expect.objectContaining({
      mcpToken: expect.stringMatching(/^lfmcp_v1\./),
    })
  );
  await expect(
    verifyConnectorMcpToken({
      provider: "x",
      purpose,
      token: call?.mcpToken ?? "",
    })
  ).resolves.toMatchObject({ purpose });
}

describe("connector catalog services", () => {
  beforeEach(() => {
    envMock.LINEAR_CLIENT_ID = "linear_client_test";
    envMock.LINEAR_CLIENT_SECRET = "linear_secret_test";
    envMock.X_CLIENT_ID = "x_client_test";
    envMock.X_CLIENT_SECRET = "x_secret_test";
    listCurrentOrgConnectorConnectionsMock.mockReset();
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([]);
  });

  it("lists catalog rows with management, availability, missing config, and display-safe tools", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({ enabledForAutomations: true }),
    ]);

    const rows = await listConnectorsForOrg(catalogCtx());

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          availableForAgents: false,
          availableForAutomations: true,
          canManage: true,
          catalogStatus: "available",
          connectAvailability: { status: "available" },
          connection: expect.objectContaining({
            enabledForAgents: false,
            status: "active",
            tools: [
              {
                availableForAgents: false,
                availableForAutomations: true,
                description: "Create issue",
                name: "create_issue",
              },
              {
                availableForAgents: false,
                availableForAutomations: false,
                description: "Unsupported",
                name: "Create Issue",
              },
            ],
          }),
          provider: "linear",
        }),
      ])
    );
    expect(rows.find((row) => row.provider === "x")).toMatchObject({
      connectAvailability: { status: "available" },
      provider: "x",
    });
    expect(listCurrentOrgConnectorConnectionsMock).toHaveBeenCalledWith(
      expect.anything(),
      { clerkOrgId: "org_acme" }
    );

    envMock.X_CLIENT_SECRET = undefined as unknown as string;
    const missingXConfigRows = await listConnectorsForOrg(catalogCtx());
    expect(
      missingXConfigRows.find((row) => row.provider === "x")
    ).toMatchObject({
      connectAvailability: {
        missing: ["X_CLIENT_SECRET"],
        reason: "missing_config",
        status: "unavailable",
      },
    });
  });

  it("marks connectors unavailable when the viewer cannot manage them", async () => {
    const rows = await listConnectorsForOrg(catalogCtx({ canManage: false }));

    expect(rows).toContainEqual(
      expect.objectContaining({
        canManage: false,
        connectAvailability: {
          reason: "permission_required",
          status: "unavailable",
        },
        provider: "linear",
      })
    );
  });

  it("marks X connections with missing requested scopes for reconnect", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        provider: "x",
        providerWorkspaceId: null,
        providerWorkspaceName: "X",
        scopes: ["tweet.read", "users.read", "offline.access"],
        toolManifest: [{ description: "Look up account", name: "getUsersMe" }],
      }),
    ]);

    const rows = await listConnectorsForOrg(catalogCtx());
    const xRow = rows.find((row) => row.provider === "x");

    expect(xRow?.connection).toMatchObject({
      missingScopes: expect.arrayContaining(["tweet.write", "dm.write"]),
      scopeStatus: "missing_requested_scopes",
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

  it("resolves required Linear connector config with defaults and development overrides", () => {
    expect(
      parseLinearConnectorConfig({
        appOrigin: "https://app.lightfast.localhost",
        env: {
          LINEAR_CLIENT_ID: "linear_client_test",
          LINEAR_CLIENT_SECRET: "linear_secret_test",
        },
        nodeEnv: "production",
      })
    ).toMatchObject({
      clientId: "linear_client_test",
      clientSecret: "linear_secret_test",
      endpoints: {
        apiOrigin: "https://api.linear.app",
        appOrigin: "https://linear.app",
        mcpEndpoint: "https://mcp.linear.app/mcp",
        oauthAuthorizeUrl: "https://linear.app/oauth/authorize",
        oauthRevokeUrl: "https://api.linear.app/oauth/revoke",
        oauthTokenUrl: "https://api.linear.app/oauth/token",
        viewerUrl: "https://api.linear.app/graphql",
      },
    });

    expect(
      parseLinearConnectorConfig({
        appOrigin: "https://app.lightfast.localhost",
        env: {
          LINEAR_API_ORIGIN: "https://linear.test",
          LINEAR_CLIENT_ID: "linear_client_test",
          LINEAR_CLIENT_SECRET: "linear_secret_test",
          LINEAR_MCP_ENDPOINT: "https://linear.test/mcp",
        },
        nodeEnv: "development",
      })
    ).toMatchObject({
      endpoints: {
        apiOrigin: "https://linear.test",
        appOrigin: "https://linear.test",
        mcpEndpoint: "https://linear.test/mcp",
        oauthAuthorizeUrl: "https://linear.test/oauth/authorize",
        oauthRevokeUrl: "https://linear.test/oauth/revoke",
        oauthTokenUrl: "https://linear.test/oauth/token",
        viewerUrl: "https://linear.test/graphql",
      },
    });
  });

  it("rejects incomplete Linear connector config when env validation is skipped", () => {
    const previous = envMock.LINEAR_CLIENT_SECRET;
    envMock.LINEAR_CLIENT_SECRET = undefined as unknown as string;

    try {
      expect(() =>
        getLinearConnectorConfig({
          appOrigin: "https://app.lightfast.localhost",
        })
      ).toThrow("Linear connector environment is incomplete.");
    } finally {
      envMock.LINEAR_CLIENT_SECRET = previous;
    }
  });

  it("rejects custom Linear endpoints outside development and test", () => {
    expect(() =>
      parseLinearConnectorConfig({
        appOrigin: "https://app.lightfast.localhost",
        env: {
          LINEAR_API_ORIGIN: "https://linear.test",
          LINEAR_CLIENT_ID: "linear_client_test",
          LINEAR_CLIENT_SECRET: "linear_secret_test",
        },
        nodeEnv: "production",
      })
    ).toThrow(
      expect.objectContaining({ code: "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN" })
    );
  });

  it("resolves X connector config from environment", () => {
    expect(getXConnectorConfig({ env: {} })).toEqual({
      missing: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
      status: "missing_config",
    });

    expect(
      getXConnectorConfig({
        appOrigin: "https://app.lightfast.localhost",
        env: {
          X_API_ORIGIN: "https://x.test",
          X_CLIENT_ID: "x_client_test",
          X_CLIENT_SECRET: "x_secret_test",
          X_MCP_ENDPOINT:
            "https://app.lightfast.localhost/api/connectors/x/mcp",
          X_OAUTH_ORIGIN: "https://x.test",
        },
        nodeEnv: "development",
      })
    ).toMatchObject({
      config: {
        clientId: "x_client_test",
        clientSecret: "x_secret_test",
        endpoints: {
          apiOrigin: "https://x.test",
          mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
          oauthAuthorizeUrl: "https://x.test/i/oauth2/authorize",
        },
      },
      status: "configured",
    });
  });

  it("issues one-time provider-scoped OAuth attempts with hashed state", async () => {
    const issued = await issueConnectorOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      provider: "linear",
    });
    const record = redisSetMock.mock.calls[0]?.[1];

    expect(record).toEqual({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      provider: "linear",
      stateHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(record)).not.toContain(issued.state);
    expect(redisSetMock).toHaveBeenCalledWith(
      "connector-oauth-attempt:linear:attempt_123456789012345678901234",
      record,
      { ex: 900 }
    );

    redisGetMock.mockResolvedValueOnce(record);
    redisGetdelMock.mockResolvedValueOnce(record);

    await expect(
      consumeConnectorOAuthAttempt({ provider: "linear", state: issued.state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_acme",
      lightfastUserId: "user_current",
      mode: "connect",
    });

    redisGetMock.mockResolvedValueOnce(record);
    redisGetdelMock.mockResolvedValueOnce(null);

    await expect(
      consumeConnectorOAuthAttempt({ provider: "linear", state: issued.state })
    ).resolves.toBeNull();
  });

  it("does not consume an OAuth attempt through the wrong provider scope", async () => {
    const issued = await issueConnectorOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      provider: "linear",
    });

    await expect(
      consumeConnectorOAuthAttempt({ provider: "x", state: issued.state })
    ).resolves.toBeNull();
    expect(redisGetMock).toHaveBeenCalledWith(
      "connector-oauth-attempt:x:attempt_123456789012345678901234"
    );
  });

  it("looks up legacy linear attempt records during a short deploy window", async () => {
    const state = Buffer.from(
      JSON.stringify({
        attemptId: "legacy_attempt_000000000000000000",
        nonce: "legacy_nonce_123456789012345678901234",
      }),
      "utf8"
    ).toString("base64url");
    const stateHash = createHash("sha256").update(state).digest("hex");
    const legacyRecord = {
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      stateHash,
    };
    redisGetMock.mockResolvedValueOnce(null);
    redisGetMock.mockResolvedValueOnce(legacyRecord);

    await expect(
      lookupConnectorOAuthAttempt({ provider: "linear", state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      provider: "linear",
    });
    expect(redisGetMock).toHaveBeenCalledWith(
      "linear-connect-oauth-attempt:legacy_attempt_000000000000000000"
    );
  });

  it("consumes legacy linear attempt records during a short deploy window", async () => {
    const state = Buffer.from(
      JSON.stringify({
        attemptId: "legacy_attempt_000000000000000000",
        nonce: "legacy_nonce_123456789012345678901234",
      }),
      "utf8"
    ).toString("base64url");
    const stateHash = createHash("sha256").update(state).digest("hex");
    const legacyRecord = {
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      stateHash,
    };
    redisGetMock.mockResolvedValueOnce(null);
    redisGetMock.mockResolvedValueOnce(legacyRecord);
    redisGetdelMock.mockResolvedValueOnce(legacyRecord);

    await expect(
      consumeConnectorOAuthAttempt({ provider: "linear", state })
    ).resolves.toMatchObject({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      provider: "linear",
    });
    expect(redisGetMock).toHaveBeenCalledWith(
      "linear-connect-oauth-attempt:legacy_attempt_000000000000000000"
    );
    expect(redisGetdelMock).toHaveBeenCalledWith(
      "linear-connect-oauth-attempt:legacy_attempt_000000000000000000"
    );
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
    [
      "wrong user",
      { orgId: "org_acme", userId: "user_other" },
      "EXPECTED_USER_MISMATCH",
    ],
    [
      "wrong active org",
      { orgId: "org_other", userId: "user_current" },
      "ACTIVE_ORG_MISMATCH",
    ],
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
    process.env.VITE_LIGHTFAST_APP_URL = "https://app.lightfast.localhost";

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
    setConnectorAgentEnabledDbMock.mockReset();
    setConnectorAgentEnabledDbMock.mockResolvedValue(true);
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
    encryptMock.mockImplementation(
      async (value: string) => `encrypted:${value}`
    );
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
      "connector-oauth-attempt:linear:attempt_123456789012345678901234",
      expect.objectContaining({ mode: "reconnect" }),
      { ex: 900 }
    );
  });

  it("throws a clear error when skipped validation leaves Linear config incomplete", async () => {
    envMock.LINEAR_CLIENT_SECRET = undefined as unknown as string;

    await expect(startLinearConnectorOAuth(ctx())).rejects.toThrow(
      "Linear connector environment is incomplete."
    );
  });

  it("completes OAuth with the public oauth callback path", async () => {
    const issued = await issueConnectorOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      provider: "linear",
    });
    const attemptRecord = {
      ...redisSetMock.mock.calls[0]?.[1],
      provider: "linear",
    };
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
    const issued = await issueConnectorOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "reconnect",
      orgSlug: "acme",
      provider: "linear",
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
      revokeLinearOAuthTokenMock.mock.invocationCallOrder.at(-1);
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
    const issued = await issueConnectorOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      provider: "linear",
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

  it("sets Linear agent enablement through the current org connector row", async () => {
    expect(typeof linearFlow.setLinearConnectorAgentEnabled).toBe("function");

    await expect(
      linearFlow.setLinearConnectorAgentEnabled?.(ctx(), { enabled: true })
    ).resolves.toEqual({ enabled: true });

    expect(setConnectorAgentEnabledDbMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        enabled: true,
        provider: "linear",
      }
    );
  });

  it("throws a domain not-found error when Linear enablement has no current connection", async () => {
    setConnectorAgentEnabledDbMock.mockResolvedValueOnce(false);

    await expect(
      linearFlow.setLinearConnectorAgentEnabled?.(ctx(), { enabled: true })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "CONNECTOR_NOT_CONNECTED",
        kind: "not_found",
      })
    );
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

describe("X connector flow", () => {
  beforeEach(() => {
    envMock.CONNECTOR_MCP_AUTH_SECRET = "mcp_auth_secret_12345678901234567890";
    envMock.X_API_ORIGIN = "https://x.test";
    envMock.X_CLIENT_ID = "x_client_test";
    envMock.X_CLIENT_SECRET = "x_secret_test";
    envMock.X_MCP_ENDPOINT =
      "https://app.lightfast.localhost/api/connectors/x/mcp";
    envMock.X_OAUTH_ORIGIN = "https://x.test";
    process.env.VITE_LIGHTFAST_APP_URL = "https://app.lightfast.localhost";

    clerkGetOrganizationMembershipListMock.mockReset();
    createXPkcePairMock.mockReset();
    decryptMock.mockReset();
    encryptMock.mockReset();
    exchangeXOAuthCodeMock.mockReset();
    finalizeCurrentOrgConnectorConnectionMock.mockReset();
    getCurrentOrgConnectorConnectionMock.mockReset();
    getXViewerMetadataMock.mockReset();
    listXBridgeMcpToolsMock.mockReset();
    logWarnMock.mockReset();
    markCurrentOrgConnectorConnectionRevokedMock.mockReset();
    recordConnectorToolRefreshErrorMock.mockReset();
    refreshXOAuthTokenMock.mockReset();
    revokeXOAuthTokenMock.mockReset();
    updateConnectorToolManifestAndAutomationStateMock.mockReset();
    nanoidMock.mockReset();
    redisGetMock.mockReset();
    redisGetdelMock.mockReset();
    redisSetMock.mockReset();

    clerkGetOrganizationMembershipListMock.mockResolvedValue({
      data: [membership()],
      totalCount: 1,
    });
    createXPkcePairMock.mockReturnValue({
      codeChallenge: "x_challenge_123",
      codeChallengeMethod: "S256",
      codeVerifier: "x_verifier_123",
    });
    decryptMock.mockImplementation(async (value: string) =>
      value === "encrypted_x_access_new"
        ? "x_access_token_new"
        : value === "encrypted_x_refresh_new"
          ? "x_refresh_token_new"
          : value === "encrypted_x_access"
            ? "x_access_token"
            : "x_refresh_token"
    );
    encryptMock.mockImplementation(
      async (value: string) => `encrypted:${value}`
    );
    nanoidMock.mockReturnValue("attempt_123456789012345678901234");
    markCurrentOrgConnectorConnectionRevokedMock.mockResolvedValue(
      connection({ provider: "x", status: "revoked" })
    );
  });

  it("starts connect or reconnect with the X OAuth callback path", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(undefined);

    const connectResult = await startXConnectorOAuth(ctx());

    expect(connectResult).toMatchObject({
      authorizationUrl: expect.stringContaining(
        "https://x.test/i/oauth2/authorize"
      ),
      mode: "connect",
    });
    const connectUrl = new URL(connectResult.authorizationUrl);
    expect(connectUrl.searchParams.get("redirect_uri")).toBe(
      "https://app.lightfast.localhost/api/connectors/x/oauth/callback"
    );
    expect(connectUrl.searchParams.get("scope")).toBe(X_OAUTH_SCOPE);

    getCurrentOrgConnectorConnectionMock.mockResolvedValueOnce(
      connection({ provider: "x" })
    );

    await expect(startXConnectorOAuth(ctx())).resolves.toMatchObject({
      authorizationUrl: expect.stringContaining("state="),
      mode: "reconnect",
    });

    expect(redisSetMock).toHaveBeenLastCalledWith(
      "connector-oauth-attempt:x:attempt_123456789012345678901234",
      expect.objectContaining({ mode: "reconnect", provider: "x" }),
      { ex: 900 }
    );
  });

  it("completes OAuth, persists X, discovers bridge tools, and enables automations", async () => {
    const issued = await issueConnectorOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "x_verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      provider: "x",
    });
    const attemptRecord = redisSetMock.mock.calls[0]?.[1];
    redisGetMock
      .mockResolvedValueOnce(attemptRecord)
      .mockResolvedValueOnce(attemptRecord);
    redisGetdelMock.mockResolvedValueOnce(attemptRecord);
    authMock.mockResolvedValue({ orgId: "org_acme", userId: "user_current" });
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(undefined);
    exchangeXOAuthCodeMock.mockResolvedValue({
      accessToken: "x_access_token",
      accessTokenExpiresIn: 3600,
      refreshToken: "x_refresh_token",
      refreshTokenExpiresIn: 86_400,
      scopes: ["tweet.read", "users.read", "offline.access"],
      tokenType: "Bearer",
    });
    getXViewerMetadataMock.mockResolvedValue({
      actorId: "x_user_1",
      actorName: "@lightfast",
      name: "Lightfast",
      username: "lightfast",
    });
    finalizeCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({
        id: 42,
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        provider: "x",
        toolManifest: [],
      })
    );
    listXBridgeMcpToolsMock.mockResolvedValue([{ name: "getUsersMe" }]);
    updateConnectorToolManifestAndAutomationStateMock.mockResolvedValue(true);

    await expect(
      completeXConnectorOAuth({
        appOrigin: "https://app.lightfast.localhost",
        redirectPaths: testXConnectorOAuthRedirectPaths,
        requestUrl: `https://app.lightfast.localhost/api/connectors/x/oauth/callback?code=code_123&state=${issued.state}`,
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/tasks/connectors/x/complete",
    });

    expect(finalizeCurrentOrgConnectorConnectionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        enabledForAutomations: false,
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        metadata: {
          mode: "connect",
          name: "Lightfast",
          username: "lightfast",
        },
        provider: "x",
        providerActorId: "x_user_1",
        providerActorName: "@lightfast",
        providerWorkspaceId: null,
        providerWorkspaceName: "X",
        scopes: ["tweet.read", "users.read", "offline.access"],
        toolManifest: [],
      })
    );
    expect(listXBridgeMcpToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        endpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        mcpToken: expect.stringMatching(/^lfmcp_v1\./),
      })
    );
    await expectLastXBridgeListTokenPurpose("discover");
    expect(
      updateConnectorToolManifestAndAutomationStateMock
    ).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clerkOrgId: "org_acme",
        enabledForAutomations: true,
        provider: "x",
        toolManifest: [{ name: "getUsersMe" }],
      })
    );
  });

  it("returns reconnects to the X connector catalog after OAuth completion", async () => {
    const issued = await issueConnectorOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "x_verifier_123",
      lightfastUserId: "user_current",
      mode: "reconnect",
      orgSlug: "acme",
      provider: "x",
    });
    const attemptRecord = redisSetMock.mock.calls[0]?.[1];
    redisGetMock
      .mockResolvedValueOnce(attemptRecord)
      .mockResolvedValueOnce(attemptRecord);
    redisGetdelMock.mockResolvedValueOnce(attemptRecord);
    authMock.mockResolvedValue({ orgId: "org_acme", userId: "user_current" });
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({ provider: "x" })
    );
    exchangeXOAuthCodeMock.mockResolvedValue({
      accessToken: "x_access_token",
      accessTokenExpiresIn: 3600,
      refreshToken: "x_refresh_token",
      refreshTokenExpiresIn: 86_400,
      scopes: ["tweet.read", "users.read", "offline.access"],
      tokenType: "Bearer",
    });
    getXViewerMetadataMock.mockResolvedValue({
      actorId: "x_user_1",
      actorName: "@lightfast",
      name: "Lightfast",
      username: "lightfast",
    });
    finalizeCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({
        id: 42,
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        provider: "x",
        toolManifest: [],
      })
    );
    listXBridgeMcpToolsMock.mockResolvedValue([{ name: "getUsersMe" }]);
    updateConnectorToolManifestAndAutomationStateMock.mockResolvedValue(true);

    await expect(
      completeXConnectorOAuth({
        appOrigin: "https://app.lightfast.localhost",
        redirectPaths: testXConnectorOAuthRedirectPaths,
        requestUrl: `https://app.lightfast.localhost/api/connectors/x/oauth/callback?code=code_123&state=${issued.state}`,
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/connectors?connector=x",
    });
    await expectLastXBridgeListTokenPurpose("discover");
  });

  it("records tool discovery failure after persisting X and keeps automations disabled", async () => {
    const issued = await issueConnectorOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "x_verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      provider: "x",
    });
    const attemptRecord = redisSetMock.mock.calls[0]?.[1];
    redisGetMock
      .mockResolvedValueOnce(attemptRecord)
      .mockResolvedValueOnce(attemptRecord);
    redisGetdelMock.mockResolvedValueOnce(attemptRecord);
    authMock.mockResolvedValue({ orgId: "org_acme", userId: "user_current" });
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(undefined);
    exchangeXOAuthCodeMock.mockResolvedValue({
      accessToken: "x_access_token",
      accessTokenExpiresIn: 3600,
      refreshToken: "x_refresh_token",
      refreshTokenExpiresIn: 86_400,
      scopes: ["tweet.read", "users.read", "offline.access"],
      tokenType: "Bearer",
    });
    getXViewerMetadataMock.mockResolvedValue({
      actorId: "x_user_1",
      actorName: "@lightfast",
      name: "Lightfast",
      username: "lightfast",
    });
    finalizeCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({
        enabledForAutomations: false,
        id: 42,
        provider: "x",
        toolManifest: [],
      })
    );
    listXBridgeMcpToolsMock.mockRejectedValue(
      new XAppNodeError("X_MCP_FAILED", "X MCP tool listing failed.")
    );

    await expect(
      completeXConnectorOAuth({
        appOrigin: "https://app.lightfast.localhost",
        redirectPaths: testXConnectorOAuthRedirectPaths,
        requestUrl: `https://app.lightfast.localhost/api/connectors/x/oauth/callback?code=code_123&state=${issued.state}`,
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/connectors?connector=x&error=x_tool_discovery_failed",
    });

    expect(recordConnectorToolRefreshErrorMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        clerkOrgId: "org_acme",
        lastToolRefreshErrorCode: "X_MCP_FAILED",
        provider: "x",
      })
    );
    expect(finalizeCurrentOrgConnectorConnectionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        enabledForAutomations: false,
      })
    );
    expect(
      updateConnectorToolManifestAndAutomationStateMock
    ).not.toHaveBeenCalled();
  });

  it("revokes issued X tokens when metadata finalization fails", async () => {
    const issued = await issueConnectorOAuthAttempt({
      clerkOrgId: "org_acme",
      codeVerifier: "x_verifier_123",
      lightfastUserId: "user_current",
      mode: "connect",
      orgSlug: "acme",
      provider: "x",
    });
    const attemptRecord = redisSetMock.mock.calls[0]?.[1];
    redisGetMock
      .mockResolvedValueOnce(attemptRecord)
      .mockResolvedValueOnce(attemptRecord);
    redisGetdelMock.mockResolvedValueOnce(attemptRecord);
    authMock.mockResolvedValue({ orgId: "org_acme", userId: "user_current" });
    exchangeXOAuthCodeMock.mockResolvedValue({
      accessToken: "x_access_token",
      accessTokenExpiresIn: 3600,
      refreshToken: "x_refresh_token",
      refreshTokenExpiresIn: 86_400,
      scopes: ["tweet.read", "users.read", "offline.access"],
      tokenType: "Bearer",
    });
    getXViewerMetadataMock.mockRejectedValue(
      new XAppNodeError("X_METADATA_FAILED", "X metadata request failed.")
    );

    await expect(
      completeXConnectorOAuth({
        appOrigin: "https://app.lightfast.localhost",
        redirectPaths: testXConnectorOAuthRedirectPaths,
        requestUrl: `https://app.lightfast.localhost/api/connectors/x/oauth/callback?code=code_123&state=${issued.state}`,
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/acme/connectors?connector=x&error=x_transient_error",
    });

    expect(revokeXOAuthTokenMock).toHaveBeenCalledTimes(2);
    expect(revokeXOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "x_access_token" })
    );
    expect(revokeXOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "x_refresh_token" })
    );
    expect(finalizeCurrentOrgConnectorConnectionMock).not.toHaveBeenCalled();
  });

  it("refreshes X tools through the bridge and updates automation state", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({
        id: 42,
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        provider: "x",
      })
    );
    listXBridgeMcpToolsMock.mockResolvedValue([{ name: "getUsersMe" }]);
    updateConnectorToolManifestAndAutomationStateMock.mockResolvedValue(true);

    await expect(refreshXConnectorTools(ctx())).resolves.toEqual({
      refreshed: true,
      status: "ok",
      toolManifest: [{ name: "getUsersMe" }],
    });

    expect(listXBridgeMcpToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        endpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        mcpToken: expect.stringMatching(/^lfmcp_v1\./),
      })
    );
    await expectLastXBridgeListTokenPurpose("discover");
    expect(
      updateConnectorToolManifestAndAutomationStateMock
    ).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        enabledForAutomations: true,
        provider: "x",
        toolManifest: [{ name: "getUsersMe" }],
      })
    );
  });

  it("preserves the previous X manifest on non-auth bridge discovery failure", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({ id: 42, provider: "x" })
    );
    listXBridgeMcpToolsMock.mockRejectedValue(
      new XAppNodeError("X_MCP_FAILED", "X MCP tool listing failed.")
    );

    await expect(refreshXConnectorTools(ctx())).resolves.toEqual({
      refreshed: false,
      status: "refresh_error",
    });

    expect(recordConnectorToolRefreshErrorMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        lastToolRefreshErrorCode: "X_MCP_FAILED",
        provider: "x",
      })
    );
    expect(
      updateConnectorToolManifestAndAutomationStateMock
    ).not.toHaveBeenCalled();
  });

  it("disconnects X by revoking upstream tokens and revoking the local row", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({
        encryptedAccessToken: "encrypted_x_access",
        encryptedRefreshToken: "encrypted_x_refresh",
        provider: "x",
      })
    );

    await expect(disconnectXConnector(ctx())).resolves.toEqual({
      disconnected: true,
    });

    expect(revokeXOAuthTokenMock).toHaveBeenCalledTimes(2);
    expect(revokeXOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "x_access_token" })
    );
    expect(revokeXOAuthTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "x_refresh_token" })
    );
    expect(markCurrentOrgConnectorConnectionRevokedMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        provider: "x",
        observedEncryptedAccessToken: "encrypted_x_access",
        observedEncryptedRefreshToken: "encrypted_x_refresh",
      })
    );
  });

  it("dispatches generic connector operations to X", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({
        id: 42,
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        provider: "x",
      })
    );
    listXBridgeMcpToolsMock.mockResolvedValue([{ name: "getUsersMe" }]);
    updateConnectorToolManifestAndAutomationStateMock.mockResolvedValue(true);
    setConnectorAutomationEnabledDbMock.mockResolvedValue(true);
    setConnectorAgentEnabledDbMock.mockResolvedValue(true);

    await expect(
      startConnectorOAuth(ctx(), { provider: "x" })
    ).resolves.toMatchObject({ mode: "reconnect" });
    await expect(
      refreshConnectorTools(ctx(), { provider: "x" })
    ).resolves.toMatchObject({ refreshed: true, status: "ok" });
    await expect(
      setConnectorAutomationEnabled(ctx(), { enabled: true, provider: "x" })
    ).resolves.toEqual({ enabled: true });
    await expect(
      setConnectorAgentEnabled(ctx(), { enabled: true, provider: "x" })
    ).resolves.toEqual({ enabled: true });
    await expect(
      disconnectConnector(ctx(), { provider: "x" })
    ).resolves.toEqual({
      disconnected: true,
    });

    expect(setConnectorAgentEnabledDbMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkOrgId: "org_acme",
        enabled: true,
        provider: "x",
      }
    );
  });
});

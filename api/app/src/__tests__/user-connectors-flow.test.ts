import type { Database, UserConnectorConnection } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const nanoidMock = vi.fn();
const redisGetMock = vi.fn();
const redisGetdelMock = vi.fn();
const redisSetMock = vi.fn();
const getCurrentUserConnectorConnectionMock = vi.fn();
const listCurrentUserConnectorConnectionsMock = vi.fn();
const finalizeCurrentUserConnectorConnectionMock = vi.fn();
const markCurrentUserConnectorConnectionRevokedMock = vi.fn();
const encryptMock = vi.fn();
const listGranolaMcpToolsMock = vi.fn();
const granolaClientMetadataMock = vi.fn();
const finishAuthMock = vi.fn();
const streamableHTTPClientTransportMock = vi.fn();

const envMock = {
  ENCRYPTION_KEY:
    "0000000000000000000000000000000000000000000000000000000000000000",
  NEXT_PUBLIC_APP_URL: "https://app.lightfast.localhost",
};

class MockGranolaAppNodeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "GranolaAppNodeError";
  }
}

class MockGranolaOAuthClientProvider {
  readonly clientMetadata: unknown;
  readonly redirectUrl: string | URL;
  private readonly onAuthorizationUrl?: (authorizationUrl: URL) => unknown;
  private clientInfo?: unknown;
  private verifier?: string;
  private oauthTokens?: unknown;

  constructor(input: {
    clientInformation?: unknown;
    clientMetadata: unknown;
    codeVerifier?: string;
    onAuthorizationUrl?: (authorizationUrl: URL) => unknown;
    redirectUrl: string | URL;
    tokens?: unknown;
  }) {
    this.clientInfo = input.clientInformation;
    this.clientMetadata = input.clientMetadata;
    this.onAuthorizationUrl = input.onAuthorizationUrl;
    this.redirectUrl = input.redirectUrl;
    this.oauthTokens = input.tokens;
    this.verifier = input.codeVerifier;
  }

  clientInformation() {
    return this.clientInfo;
  }

  codeVerifier() {
    if (!this.verifier) {
      throw new Error("No code verifier saved.");
    }
    return this.verifier;
  }

  redirectToAuthorization(authorizationUrl: URL) {
    return this.onAuthorizationUrl?.(authorizationUrl);
  }

  saveClientInformation(clientInformation: unknown) {
    this.clientInfo = clientInformation;
  }

  saveCodeVerifier(codeVerifier: string) {
    this.verifier = codeVerifier;
  }

  saveTokens(tokens: unknown) {
    this.oauthTokens = tokens;
  }

  snapshot() {
    return {
      clientInformation: this.clientInfo,
      codeVerifier: this.verifier,
      tokens: this.oauthTokens,
    };
  }

  tokens() {
    return this.oauthTokens;
  }
}

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  finalizeCurrentUserConnectorConnection:
    finalizeCurrentUserConnectorConnectionMock,
  getCurrentUserConnectorConnection: getCurrentUserConnectorConnectionMock,
  listCurrentUserConnectorConnections: listCurrentUserConnectorConnectionsMock,
  markCurrentUserConnectorConnectionRevoked:
    markCurrentUserConnectorConnectionRevokedMock,
}));

vi.mock("@repo/app-encryption", () => ({
  encrypt: encryptMock,
}));

vi.mock("@repo/granola-app-node", () => ({
  DEFAULT_GRANOLA_MCP_ENDPOINT: "https://mcp.granola.ai/mcp",
  GranolaAppNodeError: MockGranolaAppNodeError,
  GranolaOAuthClientProvider: MockGranolaOAuthClientProvider,
  granolaClientMetadata: granolaClientMetadataMock,
  listGranolaMcpTools: listGranolaMcpToolsMock,
}));

vi.mock("@vendor/clerk/server", () => ({
  auth: authMock,
}));

vi.mock("@vendor/lib", () => ({
  nanoid: nanoidMock,
}));

vi.mock("@vendor/mcp", () => ({
  StreamableHTTPClientTransport: streamableHTTPClientTransportMock,
}));

vi.mock("@vendor/upstash", () => ({
  redis: {
    get: redisGetMock,
    getdel: redisGetdelMock,
    set: redisSetMock,
  },
}));

vi.mock("../env", () => ({ env: envMock }));

const {
  completeGranolaUserConnectorOAuth,
  disconnectGranolaUserConnector,
  listUserConnectorsForViewer,
  startGranolaUserConnectorOAuth,
} = await import("../services/user-connectors");

function userConnection(
  overrides: Partial<UserConnectorConnection> = {}
): UserConnectorConnection {
  return {
    accessTokenExpiresAt: new Date("2099-06-01T08:00:00.000Z"),
    clerkUserId: "user_current",
    connectedAt: new Date("2026-06-01T00:00:00.000Z"),
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    id: 1,
    lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
    lastToolRefreshErrorAt: null,
    lastToolRefreshErrorCode: null,
    mcpEndpoint: "https://mcp.granola.ai/mcp",
    metadata: {},
    provider: "granola",
    providerAccountId: null,
    providerAccountName: "Granola",
    refreshTokenExpiresAt: new Date("2026-12-01T00:00:00.000Z"),
    revokedAt: null,
    scopes: ["notes:read"],
    status: "active",
    toolManifest: [
      { description: "Search notes", name: "search_notes" },
      { name: "get_note" },
    ],
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function ctx(
  input: {
    identity?: "active" | "pending" | "unauthenticated";
    referer?: string;
  } = {}
) {
  const headers = new Headers();
  if (input.referer) {
    headers.set("referer", input.referer);
  }

  const identity =
    input.identity === "unauthenticated"
      ? ({ type: "unauthenticated" } as const)
      : input.identity === "pending"
        ? ({ type: "pending", userId: "user_current" } as const)
        : ({
            orgGate: { bindingStatus: "bound", nextSetupRequirement: null },
            orgId: "org_acme",
            type: "active",
            userId: "user_current",
          } as const);

  return {
    auth: { identity },
    db: {} as Database,
    headers,
  };
}

function oauthAttempt(overrides: Record<string, unknown> = {}) {
  return {
    attemptId: "attempt_123456789012345678901234",
    clerkUserId: "user_current",
    clientInformation: { client_id: "granola_client" },
    codeVerifier: "verifier_123",
    createdAt: "2026-06-06T00:00:00.000Z",
    provider: "granola",
    redirectUrl:
      "https://app.lightfast.localhost/api/connectors/granola/oauth/callback",
    returnTo: "/account/settings?connector=granola",
    ...overrides,
  };
}

describe("user connector catalog services", () => {
  beforeEach(() => {
    listCurrentUserConnectorConnectionsMock.mockReset();
    listCurrentUserConnectorConnectionsMock.mockResolvedValue([]);
  });

  it("returns an empty user connector catalog for unauthenticated viewers", async () => {
    await expect(
      listUserConnectorsForViewer(ctx({ identity: "unauthenticated" }))
    ).resolves.toEqual([]);

    expect(listCurrentUserConnectorConnectionsMock).not.toHaveBeenCalled();
  });

  it("lists Granola as a private user connector for signed-in pending viewers", async () => {
    await expect(
      listUserConnectorsForViewer(ctx({ identity: "pending" }))
    ).resolves.toEqual([
      expect.objectContaining({
        canManage: true,
        catalogStatus: "available",
        connectAvailability: { status: "available" },
        connection: null,
        displayName: "Granola",
        ownerType: "user",
        provider: "granola",
      }),
    ]);

    expect(listCurrentUserConnectorConnectionsMock).toHaveBeenCalledWith(
      expect.anything(),
      { clerkUserId: "user_current" }
    );
  });

  it("shapes an active Granola connection without team automation controls", async () => {
    listCurrentUserConnectorConnectionsMock.mockResolvedValue([
      userConnection({ providerAccountName: "Granola" }),
    ]);

    const rows = await listUserConnectorsForViewer(ctx());

    expect(rows).toEqual([
      expect.objectContaining({
        connection: expect.objectContaining({
          availableForInteractiveChats: true,
          providerAccountName: "Granola",
          status: "active",
          tools: [
            {
              availableForInteractiveChats: true,
              description: "Search notes",
              name: "search_notes",
            },
            { availableForInteractiveChats: true, name: "get_note" },
          ],
        }),
        ownerType: "user",
      }),
    ]);
    expect(JSON.stringify(rows[0])).not.toContain("enabledForAutomations");
    expect(JSON.stringify(rows[0])).not.toContain("enabledForAgents");
    expect(JSON.stringify(rows[0])).not.toContain("ownerType\":\"org");
  });
});

describe("Granola user connector OAuth flow", () => {
  beforeEach(() => {
    vi.useRealTimers();
    authMock.mockReset();
    authMock.mockResolvedValue({ userId: "user_current" });
    process.env.NEXT_PUBLIC_APP_URL = envMock.NEXT_PUBLIC_APP_URL;
    nanoidMock.mockReset();
    nanoidMock.mockReturnValue("attempt_123456789012345678901234");
    redisGetMock.mockReset();
    redisGetdelMock.mockReset();
    redisSetMock.mockReset();
    getCurrentUserConnectorConnectionMock.mockReset();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(undefined);
    finalizeCurrentUserConnectorConnectionMock.mockReset();
    finalizeCurrentUserConnectorConnectionMock.mockResolvedValue(
      userConnection({ id: 2 })
    );
    markCurrentUserConnectorConnectionRevokedMock.mockReset();
    markCurrentUserConnectorConnectionRevokedMock.mockResolvedValue(
      userConnection({ status: "revoked" })
    );
    encryptMock.mockReset();
    encryptMock.mockImplementation(async (value: string) => `encrypted:${value}`);
    granolaClientMetadataMock.mockReset();
    granolaClientMetadataMock.mockImplementation(
      ({ redirectUrl }: { redirectUrl: string | URL }) => ({
        client_name: "Lightfast",
        redirect_uris: [redirectUrl.toString()],
      })
    );
    finishAuthMock.mockReset();
    finishAuthMock.mockImplementation(async function (
      this: { authProvider?: { saveTokens(tokens: unknown): void } },
      _code: string
    ) {
      this.authProvider?.saveTokens({
        access_token: "granola_access",
        expires_in: 3600,
        refresh_token: "granola_refresh",
        scope: "notes:read meetings:read",
        token_type: "Bearer",
      });
    });
    streamableHTTPClientTransportMock.mockReset();
    streamableHTTPClientTransportMock.mockImplementation(function (
      this: { authProvider?: unknown; finishAuth: typeof finishAuthMock },
      _url: URL,
      opts?: { authProvider?: unknown }
    ) {
      this.authProvider = opts?.authProvider;
      this.finishAuth = finishAuthMock;
    });
    listGranolaMcpToolsMock.mockReset();
    listGranolaMcpToolsMock.mockImplementation(
      async ({
        authProvider,
      }: {
        authProvider: MockGranolaOAuthClientProvider;
      }) => {
        authProvider.saveClientInformation({ client_id: "granola_client" });
        authProvider.saveCodeVerifier("verifier_123");
        await authProvider.redirectToAuthorization(
          new URL("https://granola.test/oauth/authorize?state=provider_state")
        );
        throw new MockGranolaAppNodeError(
          "GRANOLA_MCP_AUTH_REQUIRED",
          "Granola authorization required."
        );
      }
    );
  });

  it("starts OAuth and stores the attempt under the provider-generated state", async () => {
    await expect(
      startGranolaUserConnectorOAuth(
        ctx({
          referer:
            "https://app.lightfast.localhost/account/settings?section=connectors",
        })
      )
    ).resolves.toEqual({
      authorizationUrl: "https://granola.test/oauth/authorize?state=provider_state",
      mode: "connect",
    });

    expect(redisSetMock).toHaveBeenCalledWith(
      "user-connector-oauth-attempt:provider_state",
      expect.objectContaining({
        attemptId: "attempt_123456789012345678901234",
        clerkUserId: "user_current",
        clientInformation: { client_id: "granola_client" },
        codeVerifier: "verifier_123",
        provider: "granola",
        redirectUrl:
          "https://app.lightfast.localhost/api/connectors/granola/oauth/callback",
        returnTo: "/account/settings?section=connectors",
      }),
      { ex: 15 * 60 }
    );
    expect(listGranolaMcpToolsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://mcp.granola.ai/mcp",
      })
    );
  });

  it("adds a Lightfast state when the provider authorization URL lacks state", async () => {
    listGranolaMcpToolsMock.mockImplementationOnce(
      async ({
        authProvider,
      }: {
        authProvider: MockGranolaOAuthClientProvider;
      }) => {
        authProvider.saveClientInformation({ client_id: "granola_client" });
        authProvider.saveCodeVerifier("verifier_123");
        await authProvider.redirectToAuthorization(
          new URL("https://granola.test/oauth/authorize")
        );
        throw new MockGranolaAppNodeError(
          "GRANOLA_MCP_AUTH_REQUIRED",
          "Granola authorization required."
        );
      }
    );

    const result = await startGranolaUserConnectorOAuth(ctx());

    expect(result.authorizationUrl).toBe(
      "https://granola.test/oauth/authorize?state=attempt_123456789012345678901234"
    );
    expect(redisSetMock).toHaveBeenCalledWith(
      "user-connector-oauth-attempt:attempt_123456789012345678901234",
      expect.anything(),
      { ex: 15 * 60 }
    );
  });

  it("returns reconnect mode when Granola is already connected", async () => {
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());

    await expect(startGranolaUserConnectorOAuth(ctx())).resolves.toMatchObject({
      mode: "reconnect",
    });
  });

  it("completes OAuth for the same Clerk user and finalizes encrypted Granola tokens", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-06T12:00:00.000Z"));
    const attempt = oauthAttempt({
      clientInformation: {
        client_id: "granola_client",
        client_id_issued_at: 1_774_093_200,
        client_secret: "granola_client_secret",
      },
    });
    redisGetMock.mockResolvedValue(attempt);
    redisGetdelMock.mockResolvedValue(attempt);
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());
    listGranolaMcpToolsMock.mockResolvedValueOnce([
      { description: "Search notes", name: "search_notes" },
    ]);

    await expect(
      completeGranolaUserConnectorOAuth({
        code: "oauth_code",
        requestUrl:
          "https://app.lightfast.localhost/api/connectors/granola/oauth/callback?code=oauth_code&state=provider_state",
        state: "provider_state",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/account/settings?connector=granola",
    });

    expect(redisGetMock).toHaveBeenCalledWith(
      "user-connector-oauth-attempt:provider_state"
    );
    expect(redisGetdelMock).toHaveBeenCalledWith(
      "user-connector-oauth-attempt:provider_state"
    );
    expect(authMock).toHaveBeenCalledWith({ treatPendingAsSignedOut: false });
    expect(finishAuthMock).toHaveBeenCalledWith("oauth_code");
    expect(finalizeCurrentUserConnectorConnectionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        accessTokenExpiresAt: new Date("2026-06-06T13:00:00.000Z"),
        clerkUserId: "user_current",
        encryptedAccessToken: "encrypted:granola_access",
        encryptedRefreshToken: "encrypted:granola_refresh",
        mcpEndpoint: "https://mcp.granola.ai/mcp",
        observedCurrentConnectionId: 1,
        observedEncryptedAccessToken: "encrypted_access",
        observedEncryptedRefreshToken: "encrypted_refresh",
        provider: "granola",
        providerAccountId: null,
        providerAccountName: "Granola",
        refreshTokenExpiresAt: null,
        scopes: ["notes:read", "meetings:read"],
        toolManifest: [{ description: "Search notes", name: "search_notes" }],
      })
    );
    const finalizeInput =
      finalizeCurrentUserConnectorConnectionMock.mock.calls[0]?.[1];
    expect(finalizeInput.metadata).toEqual(
      expect.objectContaining({
        oauthClientInformation: {
          client_id: "granola_client",
          client_id_issued_at: 1_774_093_200,
        },
      })
    );
    expect(JSON.stringify(finalizeInput.metadata)).not.toContain(
      "granola_client_secret"
    );
    expect(JSON.stringify(finalizeInput.metadata)).not.toContain(
      "granola_access"
    );
    expect(JSON.stringify(finalizeInput.metadata)).not.toContain(
      "granola_refresh"
    );
  });

  it("does not consume an OAuth attempt for a different Clerk user", async () => {
    redisGetMock.mockResolvedValue(oauthAttempt());
    authMock.mockResolvedValue({ userId: "user_other" });

    await expect(
      completeGranolaUserConnectorOAuth({
        code: "oauth_code",
        requestUrl:
          "https://app.lightfast.localhost/api/connectors/granola/oauth/callback?code=oauth_code&state=provider_state",
        state: "provider_state",
      })
    ).resolves.toEqual({
      redirectUrl:
        "https://app.lightfast.localhost/account/settings?connector=granola&error=permission_required",
    });

    expect(redisGetdelMock).not.toHaveBeenCalled();
    expect(finalizeCurrentUserConnectorConnectionMock).not.toHaveBeenCalled();
  });

  it("disconnects the current Granola connector with observed-current guards", async () => {
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());

    await expect(disconnectGranolaUserConnector(ctx())).resolves.toEqual({
      disconnected: true,
    });

    expect(markCurrentUserConnectorConnectionRevokedMock).toHaveBeenCalledWith(
      expect.anything(),
      {
        clerkUserId: "user_current",
        observedCurrentConnectionId: 1,
        observedEncryptedAccessToken: "encrypted_access",
        observedEncryptedRefreshToken: "encrypted_refresh",
        provider: "granola",
      }
    );
  });
});

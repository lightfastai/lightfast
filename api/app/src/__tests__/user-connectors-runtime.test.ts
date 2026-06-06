import type { Database, UserConnectorConnection } from "@db/app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUserConnectorConnectionMock = vi.fn();
const listCurrentUserConnectorConnectionsMock = vi.fn();
const markCurrentUserConnectorConnectionErrorMock = vi.fn();
const decryptMock = vi.fn();
const callGranolaMcpToolMock = vi.fn();
const granolaClientMetadataMock = vi.fn();

const envMock = {
  ENCRYPTION_KEY:
    "0000000000000000000000000000000000000000000000000000000000000000",
};

const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

class MockGranolaAppNodeError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "GranolaAppNodeError";
  }
}

class MockGranolaOAuthClientProvider {
  readonly clientMetadata: unknown;
  readonly redirectUrl: string | URL;
  private readonly oauthTokens: unknown;

  constructor(input: {
    clientInformation?: unknown;
    clientMetadata: unknown;
    codeVerifier?: string;
    onAuthorizationUrl?: (authorizationUrl: URL) => unknown;
    redirectUrl: string | URL;
    tokens?: unknown;
  }) {
    this.clientMetadata = input.clientMetadata;
    this.oauthTokens = input.tokens;
    this.redirectUrl = input.redirectUrl;
  }

  snapshot() {
    return {
      tokens: this.oauthTokens,
    };
  }

  tokens() {
    return this.oauthTokens;
  }
}

vi.mock("@db/app", () => ({
  getCurrentUserConnectorConnection: getCurrentUserConnectorConnectionMock,
  listCurrentUserConnectorConnections: listCurrentUserConnectorConnectionsMock,
  markCurrentUserConnectorConnectionError:
    markCurrentUserConnectorConnectionErrorMock,
}));

vi.mock("@repo/app-encryption", () => ({
  decrypt: decryptMock,
}));

vi.mock("@repo/granola-app-node", () => ({
  callGranolaMcpTool: callGranolaMcpToolMock,
  GranolaAppNodeError: MockGranolaAppNodeError,
  GranolaOAuthClientProvider: MockGranolaOAuthClientProvider,
  granolaClientMetadata: granolaClientMetadataMock,
}));

vi.mock("../env", () => ({ env: envMock }));

const { callUserConnectorTool, findUserConnectorTools } = await import(
  "../services/user-connectors/runtime"
);

describe("user connector chat runtime", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL =
      "https://chat.lightfast.test/workspaces/acme";

    getCurrentUserConnectorConnectionMock.mockReset();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(undefined);
    listCurrentUserConnectorConnectionsMock.mockReset();
    listCurrentUserConnectorConnectionsMock.mockResolvedValue([]);
    markCurrentUserConnectorConnectionErrorMock.mockReset();
    markCurrentUserConnectorConnectionErrorMock.mockResolvedValue(undefined);
    decryptMock.mockReset();
    decryptMock.mockImplementation(async (ciphertext: string) => {
      const tokens: Record<string, string> = {
        encrypted_access: "access_token",
        encrypted_refresh: "refresh_token",
      };
      return tokens[ciphertext] ?? `decrypted:${ciphertext}`;
    });
    callGranolaMcpToolMock.mockReset();
    callGranolaMcpToolMock.mockResolvedValue({
      content: [{ text: "meeting result", type: "text" }],
    });
    granolaClientMetadataMock.mockReset();
    granolaClientMetadataMock.mockImplementation(
      (input: { redirectUrl: string | URL }) => ({
        client_name: "Lightfast",
        redirect_uris: [input.redirectUrl.toString()],
        token_endpoint_auth_method: "none",
      })
    );
  });

  afterEach(() => {
    if (originalNextPublicAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl;
    }
  });

  it("finds active Granola tools for the owning user's chat", async () => {
    const context = userConnectorChatContext();
    listCurrentUserConnectorConnectionsMock.mockResolvedValue([
      userConnection({
        clerkUserId: "user_current",
        toolManifest: [
          {
            description: "Search notes",
            inputSchema: { type: "object" },
            name: "search_notes",
          },
          { description: "Bad manifest item", name: "bad tool name" },
        ],
      }),
      userConnection({
        id: 2,
        status: "error",
        toolManifest: [{ name: "error_state_tool" }],
      }),
    ]);

    await expect(
      findUserConnectorTools(context, {
        provider: "granola",
        query: "search",
      })
    ).resolves.toEqual({
      routines: [
        expect.objectContaining({
          description: "Search notes",
          provider: "granola",
          providerToolName: "search_notes",
          routineId: "granola__search_notes",
          title: "Search Notes",
        }),
      ],
    });

    expect(listCurrentUserConnectorConnectionsMock).toHaveBeenCalledWith(
      context.db,
      { clerkUserId: "user_current" }
    );
    const output = await findUserConnectorTools(context, { provider: "granola" });
    expect(output.routines.map((routine) => routine.providerToolName)).toEqual([
      "search_notes",
    ]);
    expect(output.routines[0]).not.toHaveProperty("inputSchema");
  });

  it("does not find another user's Granola tools", async () => {
    const context = userConnectorChatContext({ userId: "user_other" });
    listCurrentUserConnectorConnectionsMock.mockResolvedValue([]);

    await expect(findUserConnectorTools(context, {})).resolves.toEqual({
      reason: "no_connected_user_connectors",
      routines: [],
    });

    expect(listCurrentUserConnectorConnectionsMock).toHaveBeenCalledWith(
      context.db,
      { clerkUserId: "user_other" }
    );
  });

  it("applies search, routine, provider, limit, and schema filters", async () => {
    const context = userConnectorChatContext();
    const searchSchema = {
      properties: { query: { type: "string" } },
      type: "object",
    };
    const getNoteSchema = {
      properties: { id: { type: "string" } },
      type: "object",
    };
    listCurrentUserConnectorConnectionsMock.mockResolvedValue([
      userConnection({
        toolManifest: [
          {
            description: "Search meeting notes",
            inputSchema: searchSchema,
            name: "search_notes",
          },
          {
            description: "Open a meeting note",
            inputSchema: getNoteSchema,
            name: "get_note",
          },
          { description: "List action items", name: "list_actions" },
        ],
      }),
    ]);

    const limited = await findUserConnectorTools(context, {
      includeSchema: true,
      limit: 1,
      provider: "granola",
      query: "meeting",
    });

    expect(limited.routines).toEqual([
      expect.objectContaining({
        inputSchema: searchSchema,
        providerToolName: "search_notes",
        routineId: "granola__search_notes",
      }),
    ]);

    const byRoutine = await findUserConnectorTools(context, {
      routineId: "granola__get_note",
    });
    expect(byRoutine.routines).toEqual([
      expect.objectContaining({
        providerToolName: "get_note",
        routineId: "granola__get_note",
      }),
    ]);
    expect(byRoutine.routines[0]).not.toHaveProperty("inputSchema");

    await expect(
      findUserConnectorTools(context, { query: "linear issue" })
    ).resolves.toEqual({
      reason: "no_matching_tools",
      routines: [],
    });
  });

  it("calls Granola MCP through the current user's connection", async () => {
    const context = userConnectorChatContext();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());

    await expect(
      callUserConnectorTool(context, {
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).resolves.toEqual({
      provider: "granola",
      providerToolName: "search_notes",
      result: { content: [{ text: "meeting result", type: "text" }] },
      routineId: "granola__search_notes",
      status: "succeeded",
    });

    expect(getCurrentUserConnectorConnectionMock).toHaveBeenCalledWith(
      context.db,
      {
        clerkUserId: "user_current",
        provider: "granola",
      }
    );
    expect(decryptMock).toHaveBeenCalledWith(
      "encrypted_access",
      envMock.ENCRYPTION_KEY
    );
    expect(decryptMock).toHaveBeenCalledWith(
      "encrypted_refresh",
      envMock.ENCRYPTION_KEY
    );
    expect(granolaClientMetadataMock).toHaveBeenCalledWith({
      redirectUrl:
        "https://chat.lightfast.test/api/connectors/granola/oauth/callback",
    });

    const mcpCall = callGranolaMcpToolMock.mock.calls[0]?.[0] as {
      authProvider: MockGranolaOAuthClientProvider;
      endpoint: string;
      input: Record<string, unknown>;
      name: string;
    };
    expect(mcpCall).toMatchObject({
      endpoint: "https://mcp.granola.ai/mcp",
      input: { query: "SOC2" },
      name: "search_notes",
    });
    expect(mcpCall.authProvider).toBeInstanceOf(
      MockGranolaOAuthClientProvider
    );
    expect(mcpCall.authProvider.redirectUrl).toBe(
      "https://chat.lightfast.test/api/connectors/granola/oauth/callback"
    );
    expect(mcpCall.authProvider.snapshot()).toEqual({
      tokens: {
        access_token: "access_token",
        refresh_token: "refresh_token",
        token_type: "Bearer",
      },
    });
  });

  it("rejects missing and inactive user connector connections", async () => {
    const context = userConnectorChatContext();

    await expect(
      callUserConnectorTool(context, {
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).rejects.toThrow("Granola connector is not connected for this user.");

    getCurrentUserConnectorConnectionMock.mockResolvedValue(
      userConnection({ status: "error" })
    );

    await expect(
      callUserConnectorTool(context, {
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).rejects.toThrow("Granola connector is not connected for this user.");

    expect(decryptMock).not.toHaveBeenCalled();
    expect(callGranolaMcpToolMock).not.toHaveBeenCalled();
  });

  it("rejects missing user connector tools", async () => {
    const context = userConnectorChatContext();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(
      userConnection({
        toolManifest: [{ description: "Open note", name: "get_note" }],
      })
    );

    await expect(
      callUserConnectorTool(context, {
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).rejects.toThrow(
      "User connector routine granola__search_notes was not found."
    );

    expect(decryptMock).not.toHaveBeenCalled();
    expect(callGranolaMcpToolMock).not.toHaveBeenCalled();
  });

  it("marks the current user connection error on Granola auth-required failures", async () => {
    const context = userConnectorChatContext();
    const connection = userConnection();
    const authRequiredError = new MockGranolaAppNodeError(
      "GRANOLA_MCP_AUTH_REQUIRED",
      "Authorization required"
    );
    getCurrentUserConnectorConnectionMock.mockResolvedValue(connection);
    callGranolaMcpToolMock.mockRejectedValue(authRequiredError);

    await expect(
      callUserConnectorTool(context, {
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).rejects.toBe(authRequiredError);

    expect(markCurrentUserConnectorConnectionErrorMock).toHaveBeenCalledWith(
      context.db,
      {
        clerkUserId: "user_current",
        observedCurrentConnectionId: 1,
        observedEncryptedAccessToken: "encrypted_access",
        observedEncryptedRefreshToken: "encrypted_refresh",
        provider: "granola",
      }
    );
  });

  it("does not mark the current user connection error on generic failures", async () => {
    const context = userConnectorChatContext();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());
    callGranolaMcpToolMock.mockRejectedValue(new Error("transient MCP failure"));

    await expect(
      callUserConnectorTool(context, {
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).rejects.toThrow("transient MCP failure");

    expect(markCurrentUserConnectorConnectionErrorMock).not.toHaveBeenCalled();
  });

  it("decrypts the refresh token only when one is present", async () => {
    const context = userConnectorChatContext();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(
      userConnection({ encryptedRefreshToken: null })
    );

    await callUserConnectorTool(context, {
      input: { query: "SOC2" },
      routineId: "granola__search_notes",
    });

    expect(decryptMock).toHaveBeenCalledTimes(1);
    expect(decryptMock).toHaveBeenCalledWith(
      "encrypted_access",
      envMock.ENCRYPTION_KEY
    );

    const mcpCall = callGranolaMcpToolMock.mock.calls[0]?.[0] as {
      authProvider: MockGranolaOAuthClientProvider;
    };
    expect(mcpCall.authProvider.snapshot()).toEqual({
      tokens: {
        access_token: "access_token",
        token_type: "Bearer",
      },
    });
  });
});

function userConnectorChatContext(
  overrides: {
    conversationId?: string;
    orgId?: string;
    userId?: string;
  } = {}
) {
  return {
    actor: {
      orgId: overrides.orgId ?? "org_acme",
      userId: overrides.userId ?? "user_current",
    },
    db: {} as Database,
    now: () => new Date("2026-06-06T00:00:00.000Z"),
    source: {
      conversationId: overrides.conversationId ?? "conv_123",
      surface: "interactive_chat" as const,
    },
  };
}

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
    providerAccountId: "granola_account",
    providerAccountName: "Granola",
    refreshTokenExpiresAt: new Date("2099-12-01T00:00:00.000Z"),
    revokedAt: null,
    scopes: ["notes:read"],
    status: "active",
    toolManifest: [
      { description: "Search notes", name: "search_notes" },
      { description: "Open note", name: "get_note" },
    ],
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

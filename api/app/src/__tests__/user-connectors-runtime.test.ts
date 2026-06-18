import type { Database, UserConnectorConnection } from "@db/app";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createUserConnectorToolCallMock = vi.fn();
const getCurrentUserConnectorConnectionMock = vi.fn();
const listCurrentUserConnectorConnectionsMock = vi.fn();
const markCurrentUserConnectorConnectionErrorMock = vi.fn();
const markUserConnectorToolCallFailedMock = vi.fn();
const markUserConnectorToolCallProviderAttemptedMock = vi.fn();
const markUserConnectorToolCallSucceededMock = vi.fn();
const updateObservedUserConnectorTokensMock = vi.fn();
const decryptMock = vi.fn();
const encryptMock = vi.fn();
const callGranolaMcpToolMock = vi.fn();
const granolaClientMetadataMock = vi.fn();
const logWarnMock = vi.fn();

const envMock = {
  ENCRYPTION_KEY:
    "0000000000000000000000000000000000000000000000000000000000000000",
};

const originalNextPublicAppUrl = process.env.VITE_LIGHTFAST_APP_URL;

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
  private readonly clientInfo?: unknown;
  private oauthTokens: unknown;

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
    this.oauthTokens = input.tokens;
    this.redirectUrl = input.redirectUrl;
  }

  saveTokens(tokens: unknown) {
    this.oauthTokens = tokens;
  }

  snapshot() {
    return {
      clientInformation: this.clientInfo,
      tokens: this.oauthTokens,
    };
  }

  tokens() {
    return this.oauthTokens;
  }
}

vi.mock("@db/app", () => ({
  createUserConnectorToolCall: createUserConnectorToolCallMock,
  getCurrentUserConnectorConnection: getCurrentUserConnectorConnectionMock,
  listCurrentUserConnectorConnections: listCurrentUserConnectorConnectionsMock,
  markCurrentUserConnectorConnectionError:
    markCurrentUserConnectorConnectionErrorMock,
  markUserConnectorToolCallFailed: markUserConnectorToolCallFailedMock,
  markUserConnectorToolCallProviderAttempted:
    markUserConnectorToolCallProviderAttemptedMock,
  markUserConnectorToolCallSucceeded: markUserConnectorToolCallSucceededMock,
  updateObservedUserConnectorTokens: updateObservedUserConnectorTokensMock,
}));

vi.mock("@repo/app-encryption", () => ({
  decrypt: decryptMock,
  encrypt: encryptMock,
}));

vi.mock("@lightfast/connector-granola/node", () => ({
  callGranolaMcpTool: callGranolaMcpToolMock,
  GranolaAppNodeError: MockGranolaAppNodeError,
  GranolaOAuthClientProvider: MockGranolaOAuthClientProvider,
  granolaClientMetadata: granolaClientMetadataMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    warn: logWarnMock,
  },
}));

vi.mock("../env", () => ({ env: envMock }));

const { callUserConnectorTool, findUserConnectorTools } = await import(
  "../services/user-connectors/runtime"
);

describe("user connector chat runtime", () => {
  beforeEach(() => {
    process.env.VITE_LIGHTFAST_APP_URL =
      "https://chat.lightfast.test/workspaces/acme";

    getCurrentUserConnectorConnectionMock.mockReset();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(undefined);
    createUserConnectorToolCallMock.mockReset();
    createUserConnectorToolCallMock.mockResolvedValue({
      publicId: "user_connector_tool_call_123",
    });
    listCurrentUserConnectorConnectionsMock.mockReset();
    listCurrentUserConnectorConnectionsMock.mockResolvedValue([]);
    markCurrentUserConnectorConnectionErrorMock.mockReset();
    markCurrentUserConnectorConnectionErrorMock.mockResolvedValue(undefined);
    markUserConnectorToolCallFailedMock.mockReset();
    markUserConnectorToolCallFailedMock.mockResolvedValue(true);
    markUserConnectorToolCallProviderAttemptedMock.mockReset();
    markUserConnectorToolCallProviderAttemptedMock.mockResolvedValue(true);
    markUserConnectorToolCallSucceededMock.mockReset();
    markUserConnectorToolCallSucceededMock.mockResolvedValue(true);
    updateObservedUserConnectorTokensMock.mockReset();
    updateObservedUserConnectorTokensMock.mockResolvedValue(true);
    decryptMock.mockReset();
    decryptMock.mockImplementation(async (ciphertext: string) => {
      const tokens: Record<string, string> = {
        encrypted_access: "access_token",
        encrypted_refresh: "refresh_token",
      };
      return tokens[ciphertext] ?? `decrypted:${ciphertext}`;
    });
    encryptMock.mockReset();
    encryptMock.mockImplementation(async (plaintext: string) => {
      const tokens: Record<string, string> = {
        rotated_access_token: "encrypted_rotated_access",
        rotated_refresh_token: "encrypted_rotated_refresh",
      };
      return tokens[plaintext] ?? `encrypted:${plaintext}`;
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
    logWarnMock.mockReset();
  });

  afterEach(() => {
    if (originalNextPublicAppUrl === undefined) {
      delete process.env.VITE_LIGHTFAST_APP_URL;
    } else {
      process.env.VITE_LIGHTFAST_APP_URL = originalNextPublicAppUrl;
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
    const output = await findUserConnectorTools(context, {
      provider: "granola",
    });
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
    expect(mcpCall.authProvider).toBeInstanceOf(MockGranolaOAuthClientProvider);
    expect(mcpCall.authProvider.redirectUrl).toBe(
      "https://chat.lightfast.test/api/connectors/granola/oauth/callback"
    );
    expect(mcpCall.authProvider.snapshot()).toEqual({
      clientInformation: undefined,
      tokens: {
        access_token: "access_token",
        refresh_token: "refresh_token",
        token_type: "Bearer",
      },
    });
    expect(createUserConnectorToolCallMock).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        calledByUserId: "user_current",
        clerkOrgId: "org_acme",
        inputRedacted: { present: true },
        provider: "granola",
        providerConnectionId: 1,
        providerToolName: "search_notes",
        routineId: "granola__search_notes",
        sourceRef: "conv_123",
        sourceSurface: "interactive_chat",
        startedAt: new Date("2026-06-06T00:00:00.000Z"),
      })
    );
    expect(markUserConnectorToolCallProviderAttemptedMock).toHaveBeenCalledWith(
      context.db,
      {
        calledByUserId: "user_current",
        publicId: "user_connector_tool_call_123",
      }
    );
    expect(markUserConnectorToolCallSucceededMock).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        calledByUserId: "user_current",
        outputRedacted: { present: true },
        publicId: "user_connector_tool_call_123",
      })
    );
    const auditCreateOrder =
      createUserConnectorToolCallMock.mock.invocationCallOrder[0];
    const decryptOrder = decryptMock.mock.invocationCallOrder[0];
    const attemptedOrder =
      markUserConnectorToolCallProviderAttemptedMock.mock
        .invocationCallOrder[0];
    const providerOrder = callGranolaMcpToolMock.mock.invocationCallOrder[0];
    const succeededOrder =
      markUserConnectorToolCallSucceededMock.mock.invocationCallOrder[0];
    expect(typeof auditCreateOrder).toBe("number");
    expect(typeof decryptOrder).toBe("number");
    expect(typeof attemptedOrder).toBe("number");
    expect(typeof providerOrder).toBe("number");
    expect(typeof succeededOrder).toBe("number");
    expect(auditCreateOrder!).toBeLessThan(decryptOrder!);
    expect(attemptedOrder!).toBeLessThan(providerOrder!);
    expect(succeededOrder!).toBeGreaterThan(providerOrder!);
  });

  it("reconstructs the Granola OAuth provider with persisted client information", async () => {
    const context = userConnectorChatContext();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(
      userConnection({
        metadata: {
          oauthClientInformation: {
            client_id: "granola_client",
            client_id_issued_at: 1_774_093_200,
          },
        },
      })
    );

    await callUserConnectorTool(context, {
      input: { query: "SOC2" },
      routineId: "granola__search_notes",
    });

    const mcpCall = callGranolaMcpToolMock.mock.calls[0]?.[0] as {
      authProvider: MockGranolaOAuthClientProvider;
    };
    expect(mcpCall.authProvider.snapshot()).toEqual({
      clientInformation: {
        client_id: "granola_client",
        client_id_issued_at: 1_774_093_200,
      },
      tokens: {
        access_token: "access_token",
        refresh_token: "refresh_token",
        token_type: "Bearer",
      },
    });
  });

  it("persists rotated Granola tokens with observed guards after a successful tool call", async () => {
    const context = userConnectorChatContext();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());
    callGranolaMcpToolMock.mockImplementation(
      async ({
        authProvider,
      }: {
        authProvider: MockGranolaOAuthClientProvider;
      }) => {
        authProvider.saveTokens({
          access_token: "rotated_access_token",
          expires_in: 7200,
          refresh_token: "rotated_refresh_token",
          token_type: "Bearer",
        });
        return { content: [{ text: "meeting result", type: "text" }] };
      }
    );

    await expect(
      callUserConnectorTool(context, {
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).resolves.toMatchObject({
      provider: "granola",
      status: "succeeded",
    });

    expect(encryptMock).toHaveBeenCalledWith(
      "rotated_access_token",
      envMock.ENCRYPTION_KEY
    );
    expect(encryptMock).toHaveBeenCalledWith(
      "rotated_refresh_token",
      envMock.ENCRYPTION_KEY
    );
    expect(updateObservedUserConnectorTokensMock).toHaveBeenCalledWith(
      context.db,
      {
        accessTokenExpiresAt: new Date("2026-06-06T02:00:00.000Z"),
        clerkUserId: "user_current",
        encryptedAccessToken: "encrypted_rotated_access",
        encryptedRefreshToken: "encrypted_rotated_refresh",
        id: 1,
        observedEncryptedAccessToken: "encrypted_access",
        observedEncryptedRefreshToken: "encrypted_refresh",
        refreshTokenExpiresAt: new Date("2099-12-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-06T00:00:00.000Z"),
      }
    );
  });

  it("returns tool success without leaking tokens when refreshed token persistence loses the race", async () => {
    const context = userConnectorChatContext();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());
    updateObservedUserConnectorTokensMock.mockResolvedValue(false);
    callGranolaMcpToolMock.mockImplementation(
      async ({
        authProvider,
      }: {
        authProvider: MockGranolaOAuthClientProvider;
      }) => {
        authProvider.saveTokens({
          access_token: "rotated_access_token",
          refresh_token: "rotated_refresh_token",
          token_type: "Bearer",
        });
        return { content: [{ text: "meeting result", type: "text" }] };
      }
    );

    const result = await callUserConnectorTool(context, {
      input: { query: "SOC2" },
      routineId: "granola__search_notes",
    });

    expect(result).toEqual({
      provider: "granola",
      providerToolName: "search_notes",
      result: { content: [{ text: "meeting result", type: "text" }] },
      routineId: "granola__search_notes",
      status: "succeeded",
    });
    expect(updateObservedUserConnectorTokensMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("rotated_access_token");
    expect(JSON.stringify(result)).not.toContain("rotated_refresh_token");
  });

  it("returns tool success and logs safely when audit create fails", async () => {
    const context = userConnectorChatContext();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());
    createUserConnectorToolCallMock.mockRejectedValue(new Error("db secret"));

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

    expect(logWarnMock).toHaveBeenCalledWith(
      "[user-connectors] tool call audit create failed",
      expect.objectContaining({
        calledByUserId: "user_current",
        clerkOrgId: "org_acme",
        failure: {
          name: "Error",
          type: "object",
        },
        provider: "granola",
        providerToolName: "search_notes",
        routineId: "granola__search_notes",
        sourceRef: "conv_123",
        sourceSurface: "interactive_chat",
        success: false,
      })
    );
    expect(JSON.stringify(logWarnMock.mock.calls)).not.toContain("db secret");
    expect(JSON.stringify(logWarnMock.mock.calls)).not.toContain("SOC2");
    expect(JSON.stringify(logWarnMock.mock.calls)).not.toContain(
      "access_token"
    );
  });

  it("returns tool success and logs safely when audit success mark fails", async () => {
    const context = userConnectorChatContext();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());
    markUserConnectorToolCallSucceededMock.mockRejectedValue(
      new Error("db secret")
    );

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

    expect(logWarnMock).toHaveBeenCalledWith(
      "[user-connectors] tool call audit succeeded update failed",
      expect.objectContaining({
        auditPublicId: "user_connector_tool_call_123",
        calledByUserId: "user_current",
        clerkOrgId: "org_acme",
        failure: {
          name: "Error",
          type: "object",
        },
        provider: "granola",
        providerToolName: "search_notes",
        routineId: "granola__search_notes",
        sourceRef: "conv_123",
        sourceSurface: "interactive_chat",
        success: false,
      })
    );
    expect(JSON.stringify(logWarnMock.mock.calls)).not.toContain("db secret");
    expect(JSON.stringify(logWarnMock.mock.calls)).not.toContain("SOC2");
    expect(JSON.stringify(logWarnMock.mock.calls)).not.toContain(
      "meeting result"
    );
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
    expect(createUserConnectorToolCallMock).not.toHaveBeenCalled();
    expect(
      markUserConnectorToolCallProviderAttemptedMock
    ).not.toHaveBeenCalled();
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
    expect(createUserConnectorToolCallMock).not.toHaveBeenCalled();
    expect(
      markUserConnectorToolCallProviderAttemptedMock
    ).not.toHaveBeenCalled();
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
    expect(markUserConnectorToolCallFailedMock).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        calledByUserId: "user_current",
        errorCode: "GRANOLA_MCP_AUTH_REQUIRED",
        errorMessage: "Granola authorization is required.",
        publicId: "user_connector_tool_call_123",
      })
    );
  });

  it("does not mark the current user connection error on generic failures", async () => {
    const context = userConnectorChatContext();
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());
    callGranolaMcpToolMock.mockRejectedValue(
      new Error("transient MCP failure")
    );

    await expect(
      callUserConnectorTool(context, {
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).rejects.toThrow("transient MCP failure");

    expect(markCurrentUserConnectorConnectionErrorMock).not.toHaveBeenCalled();
    const failedInput = markUserConnectorToolCallFailedMock.mock
      .calls[0]?.[1] as Record<string, unknown> | undefined;
    expect(failedInput).toMatchObject({
      calledByUserId: "user_current",
      publicId: "user_connector_tool_call_123",
    });
    expect(failedInput?.errorCode).toBeUndefined();
    expect(failedInput?.errorMessage).toBeUndefined();
  });

  it("marks the audit row failed when auth setup fails after audit create", async () => {
    const context = userConnectorChatContext();
    const setupError = new Error("decrypt failed");
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());
    decryptMock.mockRejectedValueOnce(setupError);

    await expect(
      callUserConnectorTool(context, {
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).rejects.toBe(setupError);

    expect(createUserConnectorToolCallMock).toHaveBeenCalledWith(
      context.db,
      expect.objectContaining({
        calledByUserId: "user_current",
        provider: "granola",
        providerToolName: "search_notes",
        routineId: "granola__search_notes",
      })
    );
    expect(callGranolaMcpToolMock).not.toHaveBeenCalled();
    expect(
      markUserConnectorToolCallProviderAttemptedMock
    ).not.toHaveBeenCalled();
    const failedInput = markUserConnectorToolCallFailedMock.mock
      .calls[0]?.[1] as Record<string, unknown> | undefined;
    expect(failedInput).toMatchObject({
      calledByUserId: "user_current",
      publicId: "user_connector_tool_call_123",
    });
    expect(failedInput?.errorCode).toBeUndefined();
    expect(failedInput?.errorMessage).toBeUndefined();
  });

  it("rethrows provider errors and logs safely when audit failure mark fails", async () => {
    const context = userConnectorChatContext();
    const providerError = new MockGranolaAppNodeError(
      "GRANOLA_MCP_FAILED",
      "provider secret"
    );
    getCurrentUserConnectorConnectionMock.mockResolvedValue(userConnection());
    callGranolaMcpToolMock.mockRejectedValue(providerError);
    markUserConnectorToolCallFailedMock.mockRejectedValue(
      new Error("db secret")
    );

    await expect(
      callUserConnectorTool(context, {
        input: { query: "SOC2" },
        routineId: "granola__search_notes",
      })
    ).rejects.toBe(providerError);

    expect(logWarnMock).toHaveBeenCalledWith(
      "[user-connectors] tool call audit failed update failed",
      expect.objectContaining({
        auditPublicId: "user_connector_tool_call_123",
        calledByUserId: "user_current",
        clerkOrgId: "org_acme",
        failure: {
          name: "Error",
          type: "object",
        },
        provider: "granola",
        providerToolName: "search_notes",
        routineId: "granola__search_notes",
        sourceRef: "conv_123",
        sourceSurface: "interactive_chat",
        success: false,
      })
    );
    const logged = JSON.stringify(logWarnMock.mock.calls);
    expect(logged).not.toContain("db secret");
    expect(logged).not.toContain("provider secret");
    expect(logged).not.toContain("SOC2");
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
      clientInformation: undefined,
      tokens: {
        access_token: "access_token",
        token_type: "Bearer",
      },
    });
  });
});

function userConnectorChatContext(
  overrides: { conversationId?: string; orgId?: string; userId?: string } = {}
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

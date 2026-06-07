import type { OrgConnectorConnection } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentOrgConnectorConnectionMock = vi.fn();
const listCurrentOrgConnectorConnectionsMock = vi.fn();
const loadChatConnectorRuntimeToolsMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

class TestConnectorRuntimeToolCallError extends Error {
  readonly code: string | undefined;
  readonly providerRoutineCallId: string | null;

  constructor(input: {
    code?: string;
    message: string;
    providerRoutineCallId: string | null;
  }) {
    super(input.message);
    this.name = "ConnectorRuntimeToolCallError";
    this.code = input.code;
    this.providerRoutineCallId = input.providerRoutineCallId;
  }
}

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  listCurrentOrgConnectorConnections: listCurrentOrgConnectorConnectionsMock,
}));

vi.mock("../services/connectors/runtime", () => ({
  ConnectorRuntimeToolCallError: TestConnectorRuntimeToolCallError,
  loadChatConnectorRuntimeTools: loadChatConnectorRuntimeToolsMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    info: logInfoMock,
    warn: logWarnMock,
  },
}));

const {
  ChatProviderRoutineError,
  callChatProviderRoutine,
  findChatProviderRoutines,
} = await import("../services/connectors/chat-routines");

function context(
  overrides: Partial<Parameters<typeof findChatProviderRoutines>[0]> = {}
) {
  return {
    clerkOrgId: "org_acme",
    conversationId: "conv_123",
    userId: "user_current",
    writeMode: false,
    ...overrides,
  };
}

function connection(
  overrides: Partial<OrgConnectorConnection> = {}
): OrgConnectorConnection {
  return {
    accessTokenExpiresAt: new Date("2026-06-01T08:00:00.000Z"),
    clerkOrgId: "org_acme",
    connectedAt: new Date("2026-06-01T00:00:00.000Z"),
    connectedByUserId: "user_current",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    encryptedAccessToken: "encrypted_access",
    encryptedRefreshToken: "encrypted_refresh",
    enabledForAgents: true,
    enabledForAutomations: false,
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
      {
        description: "List issues",
        inputSchema: { type: "object" },
        name: "list_issues",
      },
      {
        description: "Create issue",
        inputSchema: {
          properties: { title: { type: "string" } },
          required: ["title"],
          type: "object",
        },
        name: "create_issue",
      },
    ],
    updatedAt: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

function runtimeTool(overrides: Record<string, unknown> = {}) {
  return {
    callWithMetadata: vi.fn().mockResolvedValue({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "list_issues",
      result: { content: [{ text: "ok" }] },
      routineId: "linear__list_issues",
      runtimeToolName: "linear__list_issues",
    }),
    provider: "linear",
    providerToolName: "list_issues",
    runtimeToolName: "linear__list_issues",
    ...overrides,
  };
}

describe("chat provider routines", () => {
  beforeEach(() => {
    getCurrentOrgConnectorConnectionMock.mockReset();
    listCurrentOrgConnectorConnectionsMock.mockReset();
    loadChatConnectorRuntimeToolsMock.mockReset();
    logInfoMock.mockReset();
    logWarnMock.mockReset();
  });

  it("discovers X read routines and hides X write routines without write mode", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({
        id: 2,
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        provider: "x",
        providerWorkspaceId: null,
        providerWorkspaceName: "X",
        scopes: ["tweet.read", "users.read", "offline.access"],
        toolManifest: [
          { description: "Find user", name: "getUsersByUsername" },
          { description: "Create post", name: "createPost" },
        ],
      }),
    ]);

    await expect(findChatProviderRoutines(context(), {})).resolves.toEqual({
      routines: [
        expect.objectContaining({
          classification: "read",
          provider: "x",
          providerToolName: "getUsersByUsername",
          routineId: "x__getUsersByUsername",
        }),
      ],
    });
  });

  it("discovers X write routines when write mode is enabled", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({
        id: 2,
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        provider: "x",
        providerWorkspaceId: null,
        providerWorkspaceName: "X",
        scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
        toolManifest: [
          { description: "Find user", name: "getUsersByUsername" },
          { description: "Create post", name: "createPost" },
        ],
      }),
    ]);

    await expect(
      findChatProviderRoutines(context({ writeMode: true }), {
        query: "create",
      })
    ).resolves.toEqual({
      routines: [
        expect.objectContaining({
          classification: "write",
          provider: "x",
          providerToolName: "createPost",
          routineId: "x__createPost",
        }),
      ],
    });
  });

  it("does not discover X routines when the connection is disabled for agents", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({
        enabledForAgents: false,
        provider: "x",
        scopes: ["tweet.read", "users.read", "offline.access"],
        toolManifest: [{ name: "getUsersByUsername" }],
      }),
    ]);

    await expect(findChatProviderRoutines(context(), {})).resolves.toEqual({
      reason: "no_enabled_providers",
      routines: [],
    });
  });

  it("hides Linear write routines until write mode is enabled", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);

    await expect(findChatProviderRoutines(context(), {})).resolves.toEqual({
      routines: [
        expect.objectContaining({
          providerToolName: "list_issues",
          routineId: "linear__list_issues",
        }),
      ],
    });
  });

  it("includes Linear write routines when write mode and stored write scope are present", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);

    const result = await findChatProviderRoutines(
      context({ writeMode: true }),
      { query: "create" }
    );

    expect(result).toEqual({
      routines: [
        expect.objectContaining({
          classification: "write",
          provider: "linear",
          providerToolName: "create_issue",
          routineId: "linear__create_issue",
        }),
      ],
    });
  });

  it("returns reconnect-required warnings when Linear write scope is missing", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({ scopes: ["read"] }),
    ]);

    await expect(
      findChatProviderRoutines(context({ writeMode: true }), {})
    ).resolves.toEqual({
      routines: [
        expect.objectContaining({
          providerToolName: "list_issues",
          routineId: "linear__list_issues",
        }),
      ],
      warnings: [
        {
          code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
          message: "Reconnect Linear to enable write access.",
          provider: "linear",
          requiredScopes: ["write"],
        },
      ],
    });
  });

  it("returns no routines when chat context has no active org", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([]);

    await expect(
      findChatProviderRoutines(context({ clerkOrgId: "" }), {})
    ).resolves.toEqual({
      reason: "no_enabled_providers",
      routines: [],
    });
    expect(listCurrentOrgConnectorConnectionsMock).toHaveBeenCalledWith(
      {},
      { clerkOrgId: "" }
    );
  });

  it("ignores connector rows that do not belong to the chat context org", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({ clerkOrgId: "org_other" }),
    ]);

    await expect(findChatProviderRoutines(context(), {})).resolves.toEqual({
      reason: "no_enabled_providers",
      routines: [],
    });
  });

  it("rejects direct Linear write calls when write mode is off", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());

    await expect(
      callChatProviderRoutine(context(), {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      routineId: "linear__create_issue",
    });
    expect(loadChatConnectorRuntimeToolsMock).not.toHaveBeenCalled();
  });

  it("rejects direct calls when the current connector row belongs to another org", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({ clerkOrgId: "org_other" })
    );

    await expect(
      callChatProviderRoutine(context(), {
        input: {},
        routineId: "linear__list_issues",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_CONNECTION_REQUIRED",
      routineId: "linear__list_issues",
    });
    expect(loadChatConnectorRuntimeToolsMock).not.toHaveBeenCalled();
  });

  it("rejects direct Linear write calls with reconnect-required when stored write scope is missing", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({ scopes: ["read"] })
    );

    await expect(
      callChatProviderRoutine(context({ writeMode: true }), {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_RECONNECT_REQUIRED",
      message: "Reconnect Linear to enable write access.",
      routineId: "linear__create_issue",
    });
    expect(loadChatConnectorRuntimeToolsMock).not.toHaveBeenCalled();
  });

  it("maps expired provider auth failures to auth-required errors", async () => {
    const linearTool = runtimeTool({
      callWithMetadata: vi.fn().mockRejectedValue(
        new TestConnectorRuntimeToolCallError({
          code: "LINEAR_TOKEN_REFRESH_FAILED",
          message: "Linear OAuth token refresh failed.",
          providerRoutineCallId: "provider_routine_call_auth",
        })
      ),
    });
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    loadChatConnectorRuntimeToolsMock.mockResolvedValue([linearTool]);

    await expect(
      callChatProviderRoutine(context(), {
        input: {},
        routineId: "linear__list_issues",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_AUTH_REQUIRED",
      message: "Provider authorization is required.",
      providerRoutineCallId: "provider_routine_call_auth",
      routineId: "linear__list_issues",
    });
  });

  it("calls Linear write routines when write mode and stored write scope are present", async () => {
    const linearTool = runtimeTool({
      callWithMetadata: vi.fn().mockResolvedValue({
        provider: "linear",
        providerRoutineCallId: "provider_routine_call_linear_write",
        providerToolName: "create_issue",
        result: { content: [{ text: "created" }] },
        routineId: "linear__create_issue",
        runtimeToolName: "linear__create_issue",
      }),
      providerToolName: "create_issue",
      runtimeToolName: "linear__create_issue",
    });
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    loadChatConnectorRuntimeToolsMock.mockResolvedValue([linearTool]);

    await expect(
      callChatProviderRoutine(context({ writeMode: true }), {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).resolves.toEqual({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_linear_write",
      providerToolName: "create_issue",
      result: { content: [{ text: "created" }] },
      routineId: "linear__create_issue",
      status: "succeeded",
    });
  });

  it("calls X read routines through the chat runtime", async () => {
    const xConnection = connection({
      id: 2,
      mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      provider: "x",
      providerWorkspaceId: null,
      providerWorkspaceName: "X",
      scopes: ["tweet.read", "users.read", "offline.access"],
      toolManifest: [{ name: "getUsersByUsername" }],
    });
    const xTool = runtimeTool({
      callWithMetadata: vi.fn().mockResolvedValue({
        provider: "x",
        providerRoutineCallId: "provider_routine_call_x",
        providerToolName: "getUsersByUsername",
        result: { content: [{ text: "Lightfast" }] },
        routineId: "x__getUsersByUsername",
        runtimeToolName: "x__getUsersByUsername",
      }),
      provider: "x",
      providerToolName: "getUsersByUsername",
      runtimeToolName: "x__getUsersByUsername",
    });
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(xConnection);
    loadChatConnectorRuntimeToolsMock.mockResolvedValue([xTool]);

    await expect(
      callChatProviderRoutine(context(), {
        input: { username: "lightfast" },
        routineId: "x__getUsersByUsername",
      })
    ).resolves.toEqual({
      provider: "x",
      providerRoutineCallId: "provider_routine_call_x",
      providerToolName: "getUsersByUsername",
      result: { content: [{ text: "Lightfast" }] },
      routineId: "x__getUsersByUsername",
      status: "succeeded",
    });
    expect(loadChatConnectorRuntimeToolsMock).toHaveBeenCalledWith({
      calledByUserId: "user_current",
      clerkOrgId: "org_acme",
      conversationId: "conv_123",
    });
  });

  it("rejects X write routines when write mode is off", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({
        provider: "x",
        scopes: ["tweet.read", "users.read", "offline.access"],
        toolManifest: [{ name: "createPost" }],
      })
    );

    await expect(
      callChatProviderRoutine(context(), {
        input: { text: "hello" },
        routineId: "x__createPost",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      routineId: "x__createPost",
    });
    expect(loadChatConnectorRuntimeToolsMock).not.toHaveBeenCalled();
  });

  it("calls X write routines through the chat runtime when write mode is enabled", async () => {
    const xConnection = connection({
      id: 2,
      mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      provider: "x",
      providerWorkspaceId: null,
      providerWorkspaceName: "X",
      scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
      toolManifest: [{ name: "createPost" }],
    });
    const xTool = runtimeTool({
      callWithMetadata: vi.fn().mockResolvedValue({
        provider: "x",
        providerRoutineCallId: "provider_routine_call_x_write",
        providerToolName: "createPost",
        result: { content: [{ text: "posted" }] },
        routineId: "x__createPost",
        runtimeToolName: "x__createPost",
      }),
      provider: "x",
      providerToolName: "createPost",
      runtimeToolName: "x__createPost",
    });
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(xConnection);
    loadChatConnectorRuntimeToolsMock.mockResolvedValue([xTool]);

    await expect(
      callChatProviderRoutine(context({ writeMode: true }), {
        input: { text: "hello" },
        routineId: "x__createPost",
      })
    ).resolves.toEqual({
      provider: "x",
      providerRoutineCallId: "provider_routine_call_x_write",
      providerToolName: "createPost",
      result: { content: [{ text: "posted" }] },
      routineId: "x__createPost",
      status: "succeeded",
    });
  });

  it("logs redacted routine call decisions", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());

    await expect(
      callChatProviderRoutine(context(), {
        input: { title: "Secret issue title" },
        routineId: "linear__create_issue",
      })
    ).rejects.toBeInstanceOf(ChatProviderRoutineError);

    expect(logWarnMock).toHaveBeenCalledWith(
      "[workspace-assistant] provider routine call denied",
      expect.objectContaining({
        classification: "write",
        denialReason: "write_mode_disabled",
        provider: "linear",
        providerToolName: "create_issue",
        routineId: "linear__create_issue",
        sourceSurface: "chat",
        writeMode: false,
      })
    );
    expect(JSON.stringify(logWarnMock.mock.calls)).not.toContain(
      "Secret issue title"
    );
  });
});

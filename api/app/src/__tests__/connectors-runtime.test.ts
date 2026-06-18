import type { OrgConnectorConnection } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listCurrentOrgConnectorConnectionsMock = vi.fn();
const getCurrentOrgConnectorConnectionMock = vi.fn();
const markCurrentOrgConnectorConnectionErrorMock = vi.fn();
const createProviderRoutineCallMock = vi.fn();
const markProviderRoutineCallFailedMock = vi.fn();
const markProviderRoutineCallProviderAttemptedMock = vi.fn();
const markProviderRoutineCallSucceededMock = vi.fn();
const getFreshLinearConnectorAccessTokenMock = vi.fn();
const callLinearMcpToolMock = vi.fn();
const callXBridgeMcpToolMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

const envMock = {
  CONNECTOR_MCP_AUTH_SECRET: "mcp_auth_secret_12345678901234567890",
  ENCRYPTION_KEY:
    "0000000000000000000000000000000000000000000000000000000000000000",
  VITE_LIGHTFAST_APP_URL: "https://app.lightfast.localhost",
  VERCEL_ENV: "test",
  X_CLIENT_ID: "x_client_test",
  X_CLIENT_SECRET: "x_secret_test",
};

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  createProviderRoutineCall: createProviderRoutineCallMock,
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  listCurrentOrgConnectorConnections: listCurrentOrgConnectorConnectionsMock,
  markProviderRoutineCallFailed: markProviderRoutineCallFailedMock,
  markProviderRoutineCallProviderAttempted:
    markProviderRoutineCallProviderAttemptedMock,
  markProviderRoutineCallSucceeded: markProviderRoutineCallSucceededMock,
  markCurrentOrgConnectorConnectionError:
    markCurrentOrgConnectorConnectionErrorMock,
}));

vi.mock("@lightfast/connector-linear/mcp", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@lightfast/connector-linear/mcp")>();
  return {
    ...actual,
    callLinearMcpTool: callLinearMcpToolMock,
  };
});

vi.mock("@lightfast/connector-x/mcp", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@lightfast/connector-x/mcp")>();
  return {
    ...actual,
    callXBridgeMcpTool: callXBridgeMcpToolMock,
  };
});

vi.mock("../services/connectors/linear-flow", () => ({
  getFreshLinearConnectorAccessToken: getFreshLinearConnectorAccessTokenMock,
}));

vi.mock("../env", () => ({ env: envMock }));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    info: logInfoMock,
    warn: logWarnMock,
  },
}));

const {
  ConnectorRuntimeToolCallError,
  loadAgentConnectorRuntimeTools,
  loadChatConnectorRuntimeTools,
  loadConnectorRuntimeTools,
} = await import("../services/connectors/runtime");
const { LinearAppNodeError } = await import("@lightfast/connector-linear/node");
const { XAppNodeError } = await import("@lightfast/connector-x/node");

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

async function catchRejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected promise to reject.");
}

describe("loadConnectorRuntimeTools", () => {
  beforeEach(() => {
    process.env.VITE_LIGHTFAST_APP_URL = envMock.VITE_LIGHTFAST_APP_URL;
    listCurrentOrgConnectorConnectionsMock.mockReset();
    getCurrentOrgConnectorConnectionMock.mockReset();
    markCurrentOrgConnectorConnectionErrorMock.mockReset();
    markCurrentOrgConnectorConnectionErrorMock.mockResolvedValue(undefined);
    createProviderRoutineCallMock.mockReset();
    createProviderRoutineCallMock.mockResolvedValue({
      publicId: "provider_routine_call_123",
    });
    markProviderRoutineCallFailedMock.mockReset();
    markProviderRoutineCallFailedMock.mockResolvedValue(true);
    markProviderRoutineCallProviderAttemptedMock.mockReset();
    markProviderRoutineCallProviderAttemptedMock.mockResolvedValue(true);
    markProviderRoutineCallSucceededMock.mockReset();
    markProviderRoutineCallSucceededMock.mockResolvedValue(true);
    getFreshLinearConnectorAccessTokenMock.mockReset();
    getFreshLinearConnectorAccessTokenMock.mockResolvedValue("lin_access");
    callLinearMcpToolMock.mockReset();
    callLinearMcpToolMock.mockResolvedValue({ content: [{ text: "ok" }] });
    callXBridgeMcpToolMock.mockReset();
    callXBridgeMcpToolMock.mockResolvedValue({ content: [{ text: "x ok" }] });
    logInfoMock.mockReset();
    logWarnMock.mockReset();
  });

  it("loads active automation-enabled Linear and X connections with valid cached tools", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection(),
      connection({
        id: 4,
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        provider: "x",
        providerWorkspaceId: null,
        providerWorkspaceName: "X",
        scopes: ["tweet.read", "users.read", "offline.access"],
        toolManifest: [
          { description: "Look up account", name: "getUsersByUsername" },
        ],
      }),
      connection({
        enabledForAutomations: false,
        id: 2,
        toolManifest: [{ name: "disabled_tool" }],
      }),
      connection({
        id: 3,
        status: "error",
        toolManifest: [{ name: "cached_error_tool" }],
      }),
    ]);

    const tools = await loadConnectorRuntimeTools({ clerkOrgId: "org_acme" });

    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          description: "Create issue",
          provider: "linear",
          providerToolName: "create_issue",
          runtimeToolName: "linear__create_issue",
        }),
        expect.objectContaining({
          description: "Look up account",
          provider: "x",
          providerToolName: "getUsersByUsername",
          runtimeToolName: "x__getUsersByUsername",
        }),
      ])
    );
    expect(listCurrentOrgConnectorConnectionsMock).toHaveBeenCalledWith(
      {},
      { clerkOrgId: "org_acme" }
    );
  });

  it("loads active agent-enabled tools for chat without requiring automation access", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({
        enabledForAgents: true,
        enabledForAutomations: false,
        toolManifest: [{ description: "List issues", name: "list_issues" }],
      }),
      connection({
        enabledForAgents: true,
        enabledForAutomations: false,
        id: 42,
        mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
        provider: "x",
        providerWorkspaceId: null,
        providerWorkspaceName: "X",
        scopes: ["tweet.read", "users.read", "offline.access"],
        toolManifest: [{ description: "Create post", name: "createPost" }],
      }),
    ]);

    const tools = await loadChatConnectorRuntimeTools({
      calledByUserId: "user_current",
      clerkOrgId: "org_acme",
      conversationId: "conv_123",
    });

    expect(tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "linear",
          providerToolName: "list_issues",
          runtimeToolName: "linear__list_issues",
        }),
        expect.objectContaining({
          provider: "x",
          providerToolName: "createPost",
          runtimeToolName: "x__createPost",
        }),
      ])
    );
  });

  it("does not load agent tools from connectors disabled for agents", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection({
        enabledForAgents: false,
        enabledForAutomations: true,
        provider: "x",
        toolManifest: [{ name: "createPost" }],
      }),
    ]);

    await expect(
      loadChatConnectorRuntimeTools({
        calledByUserId: "user_current",
        clerkOrgId: "org_acme",
        conversationId: "conv_123",
      })
    ).resolves.toEqual([]);
  });

  it("records chat runtime calls with user caller and chat source metadata", async () => {
    const chatConnection = connection({
      enabledForAgents: true,
      enabledForAutomations: false,
      toolManifest: [{ name: "list_issues" }],
    });
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([chatConnection]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(chatConnection);
    callLinearMcpToolMock.mockResolvedValue({
      content: [{ text: "issue list" }],
    });

    const [tool] = await loadChatConnectorRuntimeTools({
      calledByUserId: "user_current",
      clerkOrgId: "org_acme",
      conversationId: "conv_123",
    });

    await expect(tool?.callWithMetadata({ query: "bug" })).resolves.toEqual({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "list_issues",
      result: { content: [{ text: "issue list" }] },
      routineId: "linear__list_issues",
      runtimeToolName: "linear__list_issues",
    });

    expect(createProviderRoutineCallMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        calledById: "user_current",
        calledByKind: "user",
        calledByUserId: "user_current",
        clerkOrgId: "org_acme",
        provider: "linear",
        providerConnectionId: 1,
        providerToolName: "list_issues",
        routineId: "linear__list_issues",
        sourceClientId: null,
        sourceRef: "conv_123",
        sourceSurface: "chat",
      })
    );
  });

  it("records hosted MCP runtime calls with client source attribution", async () => {
    const mcpConnection = connection({
      enabledForAgents: true,
      enabledForAutomations: false,
      toolManifest: [{ name: "list_issues" }],
    });
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([mcpConnection]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(mcpConnection);
    callLinearMcpToolMock.mockResolvedValue({
      content: [{ text: "issue list" }],
    });

    const [tool] = await loadAgentConnectorRuntimeTools({
      calledByUserId: "user_current",
      clerkOrgId: "org_acme",
      sourceClientId: "mcp_client_123",
      sourceRef: "grant_123",
      sourceSurface: "hosted_mcp",
    });

    await tool?.callWithMetadata({ query: "bug" });

    expect(createProviderRoutineCallMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        calledById: "user_current",
        calledByKind: "user",
        calledByUserId: "user_current",
        clerkOrgId: "org_acme",
        provider: "linear",
        providerConnectionId: 1,
        providerToolName: "list_issues",
        routineId: "linear__list_issues",
        sourceClientId: "mcp_client_123",
        sourceRef: "grant_123",
        sourceSurface: "hosted_mcp",
      })
    );
  });

  it("records X chat connector calls with chat source attribution", async () => {
    const xConnection = connection({
      enabledForAgents: true,
      enabledForAutomations: false,
      id: 8,
      mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      provider: "x",
      providerActorId: "x_user_1",
      providerWorkspaceId: null,
      providerWorkspaceName: "X",
      toolManifest: [{ description: "Create post", name: "createPost" }],
    });
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([xConnection]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(xConnection);

    const [tool] = await loadChatConnectorRuntimeTools({
      calledByUserId: "user_agent",
      clerkOrgId: "org_acme",
      conversationId: "conv_123",
    });

    await tool?.call({ text: "ship it" });

    expect(createProviderRoutineCallMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        calledById: "user_agent",
        calledByKind: "user",
        calledByUserId: "user_agent",
        provider: "x",
        providerConnectionId: 8,
        providerToolName: "createPost",
        routineId: "x__createPost",
        sourceClientId: null,
        sourceRef: "conv_123",
        sourceSurface: "chat",
      })
    );
    expect(callXBridgeMcpToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { text: "ship it" },
        name: "createPost",
      })
    );
  });

  it("re-checks current active and enabled state before every call", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({ enabledForAutomations: false })
    );

    const [tool] = await loadConnectorRuntimeTools({ clerkOrgId: "org_acme" });

    await expect(tool?.call({ title: "secret-title" })).rejects.toThrow(
      "Linear connector is not active for automations."
    );
    expect(callLinearMcpToolMock).not.toHaveBeenCalled();
    expect(createProviderRoutineCallMock).not.toHaveBeenCalled();
  });

  it("records Linear MCP runtime calls as succeeded with redacted payload presence", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    callLinearMcpToolMock.mockResolvedValue({
      content: [{ text: "mcp_result" }],
    });

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });
    const result = await tool?.call({ title: "secret-title" });

    expect(result).toEqual({ content: [{ text: "mcp_result" }] });
    expect(createProviderRoutineCallMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        calledById: "run_123",
        calledByKind: "automation",
        calledByUserId: null,
        clerkOrgId: "org_acme",
        providerConnectionId: 1,
        inputRedacted: { present: true },
        provider: "linear",
        providerActorId: "actor_1",
        providerToolName: "create_issue",
        providerWorkspaceId: "workspace_1",
        routineId: "linear__create_issue",
        sourceClientId: null,
        sourceRef: "run_123",
        sourceSurface: "automation",
      })
    );
    expect(getFreshLinearConnectorAccessTokenMock).toHaveBeenCalledWith({
      connection: expect.objectContaining({ id: 1 }),
      db: {},
    });
    expect(callLinearMcpToolMock).toHaveBeenCalledWith({
      accessToken: "lin_access",
      endpoint: "https://linear.test/mcp",
      input: { title: "secret-title" },
      name: "create_issue",
    });
    expect(markProviderRoutineCallProviderAttemptedMock).toHaveBeenCalledWith(
      {},
      {
        clerkOrgId: "org_acme",
        publicId: "provider_routine_call_123",
      }
    );
    expect(markProviderRoutineCallSucceededMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        clerkOrgId: "org_acme",
        outputRedacted: { present: true },
        publicId: "provider_routine_call_123",
      })
    );
    expect(logInfoMock).toHaveBeenCalledWith(
      "[connectors] runtime tool call completed",
      expect.objectContaining({
        automationPublicId: "aut_123",
        clerkOrgId: "org_acme",
        provider: "linear",
        providerToolName: "create_issue",
        runPublicId: "run_123",
        runtimeToolName: "linear__create_issue",
        success: true,
      })
    );
    const logged = JSON.stringify(logInfoMock.mock.calls);
    expect(logged).not.toContain("secret-title");
    expect(logged).not.toContain("lin_access");
    expect(logged).not.toContain("mcp_result");
  });

  it("returns provider routine call metadata for automation calls", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    callLinearMcpToolMock.mockResolvedValue({
      content: [{ text: "mcp_result" }],
    });

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      calledByUserId: "user_owner",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });

    expect(tool?.inputSchema).toBeUndefined();

    await expect(
      tool?.callWithMetadata({ title: "secret-title" })
    ).resolves.toEqual({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "create_issue",
      result: { content: [{ text: "mcp_result" }] },
      routineId: "linear__create_issue",
      runtimeToolName: "linear__create_issue",
    });

    expect(createProviderRoutineCallMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        calledById: "run_123",
        calledByKind: "automation",
        calledByUserId: "user_owner",
        sourceRef: "run_123",
        sourceSurface: "automation",
      })
    );
  });

  it("throws runtime errors with provider routine call metadata", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    callLinearMcpToolMock.mockRejectedValue(
      new LinearAppNodeError(
        "LINEAR_MCP_FAILED",
        "Linear MCP tool call failed."
      )
    );

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      calledByUserId: "user_owner",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });

    const error = await catchRejection(
      tool!.callWithMetadata({ title: "secret-title" })
    );

    expect(error).toBeInstanceOf(ConnectorRuntimeToolCallError);
    expect(error).toMatchObject({
      code: "LINEAR_MCP_FAILED",
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "create_issue",
      routineId: "linear__create_issue",
    });
  });

  it("records system Linear MCP runtime calls when no automation run id is present", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());

    const [tool] = await loadConnectorRuntimeTools({
      clerkOrgId: "org_acme",
    });
    await tool?.call(undefined);

    expect(createProviderRoutineCallMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        calledById: "connector-runtime",
        calledByKind: "system",
        inputRedacted: null,
        sourceRef: "connector-runtime",
        sourceSurface: "system",
      })
    );
  });

  it("logs redacted failure data", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    callLinearMcpToolMock.mockRejectedValue(
      new LinearAppNodeError(
        "LINEAR_MCP_FAILED",
        "Linear MCP tool call failed."
      )
    );

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });

    await expect(tool?.call({ title: "secret-title" })).rejects.toThrow(
      "Linear MCP tool call failed."
    );
    expect(markProviderRoutineCallFailedMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        clerkOrgId: "org_acme",
        errorCode: "LINEAR_MCP_FAILED",
        errorMessage: "Linear MCP tool call failed.",
        publicId: "provider_routine_call_123",
      })
    );
    expect(logWarnMock).toHaveBeenCalledWith(
      "[connectors] runtime tool call failed",
      expect.objectContaining({
        failure: {
          code: "LINEAR_MCP_FAILED",
          message: "Linear MCP tool call failed.",
          name: "LinearAppNodeError",
        },
        provider: "linear",
        providerToolName: "create_issue",
        runtimeToolName: "linear__create_issue",
        success: false,
      })
    );
    const logged = JSON.stringify(logWarnMock.mock.calls);
    expect(logged).not.toContain("secret-title");
    expect(logged).not.toContain("lin_access");
  });

  it("does not call provider tools for automation runs when creating the ledger row fails", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    createProviderRoutineCallMock.mockRejectedValue(
      new Error("ledger write secret")
    );

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      calledByUserId: "user_owner",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });

    const error = await catchRejection(
      tool!.callWithMetadata({ title: "secret-title" })
    );

    expect(error).toBeInstanceOf(ConnectorRuntimeToolCallError);
    expect(error).toMatchObject({
      code: "PROVIDER_ROUTINE_LEDGER_FAILED",
      provider: "linear",
      providerRoutineCallId: null,
      routineId: "linear__create_issue",
    });
    expect(error).toHaveProperty(
      "cause",
      expect.objectContaining({
        message: "Provider routine call ledger row was not created.",
      })
    );

    expect(callLinearMcpToolMock).not.toHaveBeenCalled();
    expect(logWarnMock).toHaveBeenCalledWith(
      "[connectors] provider routine call ledger create failed",
      expect.objectContaining({
        clerkOrgId: "org_acme",
        failure: {
          code: undefined,
          message: undefined,
          name: "Error",
        },
        provider: "linear",
        success: false,
      })
    );
    const logged = JSON.stringify(logWarnMock.mock.calls);
    expect(logged).not.toContain("ledger write secret");
    expect(logged).not.toContain("secret-title");
  });

  it("continues system provider calls when creating the ledger row fails", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    createProviderRoutineCallMock.mockRejectedValue(
      new Error("ledger write secret")
    );
    callLinearMcpToolMock.mockResolvedValue({
      content: [{ text: "mcp_result" }],
    });

    const [tool] = await loadConnectorRuntimeTools({
      clerkOrgId: "org_acme",
    });

    await expect(
      tool?.callWithMetadata({ title: "secret-title" })
    ).resolves.toEqual({
      provider: "linear",
      providerRoutineCallId: null,
      providerToolName: "create_issue",
      result: { content: [{ text: "mcp_result" }] },
      routineId: "linear__create_issue",
      runtimeToolName: "linear__create_issue",
    });

    expect(callLinearMcpToolMock).toHaveBeenCalledOnce();
    expect(markProviderRoutineCallSucceededMock).not.toHaveBeenCalled();
    const logged = JSON.stringify(logWarnMock.mock.calls);
    expect(logged).not.toContain("ledger write secret");
    expect(logged).not.toContain("secret-title");
  });

  it("omits raw messages for non-Linear runtime failures", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    callLinearMcpToolMock.mockRejectedValue(new Error("raw downstream secret"));

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });

    await expect(tool?.call({ title: "secret-title" })).rejects.toThrow(
      "raw downstream secret"
    );
    expect(markCurrentOrgConnectorConnectionErrorMock).not.toHaveBeenCalled();
    expect(logWarnMock).toHaveBeenCalledWith(
      "[connectors] runtime tool call failed",
      expect.objectContaining({
        failure: {
          code: undefined,
          message: undefined,
          name: "Error",
        },
        provider: "linear",
        success: false,
      })
    );
    const logged = JSON.stringify(logWarnMock.mock.calls);
    expect(logged).not.toContain("secret-title");
    expect(logged).not.toContain("raw downstream secret");
  });

  it("omits raw messages for non-Linear errors with Linear-looking codes", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    const error = Object.assign(new Error("raw forged code secret"), {
      code: "LINEAR_MCP_FAILED",
    });
    callLinearMcpToolMock.mockRejectedValue(error);

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });

    await expect(tool?.call({ title: "secret-title" })).rejects.toThrow(
      "raw forged code secret"
    );
    expect(logWarnMock).toHaveBeenCalledWith(
      "[connectors] runtime tool call failed",
      expect.objectContaining({
        failure: {
          code: "LINEAR_MCP_FAILED",
          message: undefined,
          name: "Error",
        },
        provider: "linear",
        success: false,
      })
    );
    const logged = JSON.stringify(logWarnMock.mock.calls);
    expect(logged).not.toContain("secret-title");
    expect(logged).not.toContain("raw forged code secret");
  });

  it("marks the Linear connector error when token refresh terminally fails during a runtime call", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    getFreshLinearConnectorAccessTokenMock.mockRejectedValue(
      new LinearAppNodeError(
        "LINEAR_TOKEN_REFRESH_FAILED",
        "refresh token leaked raw details"
      )
    );

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });

    await expect(tool?.call({ title: "secret-title" })).rejects.toThrow(
      "refresh token leaked raw details"
    );
    expect(markProviderRoutineCallFailedMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        clerkOrgId: "org_acme",
        errorCode: "LINEAR_TOKEN_REFRESH_FAILED",
        errorMessage: "Linear OAuth token refresh failed.",
        publicId: "provider_routine_call_123",
      })
    );
    expect(markCurrentOrgConnectorConnectionErrorMock).toHaveBeenCalledWith(
      {},
      {
        clerkOrgId: "org_acme",
        provider: "linear",
      }
    );
    expect(callLinearMcpToolMock).not.toHaveBeenCalled();
    expect(markProviderRoutineCallProviderAttemptedMock).not.toHaveBeenCalled();
    expect(logWarnMock).toHaveBeenCalledWith(
      "[connectors] runtime tool call failed",
      expect.objectContaining({
        failure: {
          code: "LINEAR_TOKEN_REFRESH_FAILED",
          message: "Linear OAuth token refresh failed.",
          name: "LinearAppNodeError",
        },
        provider: "linear",
        success: false,
      })
    );
    const logged = JSON.stringify(logWarnMock.mock.calls);
    expect(logged).not.toContain("secret-title");
    expect(logged).not.toContain("lin_access");
    expect(logged).not.toContain("refresh token leaked raw details");
  });

  it("throws original provider metadata when marking the connector error fails", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    getFreshLinearConnectorAccessTokenMock.mockRejectedValue(
      new LinearAppNodeError(
        "LINEAR_TOKEN_REFRESH_FAILED",
        "refresh token leaked raw details"
      )
    );
    markCurrentOrgConnectorConnectionErrorMock.mockRejectedValue(
      new Error("mark connection secret")
    );

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });

    const error = await catchRejection(
      tool!.callWithMetadata({ title: "secret-title" })
    );

    expect(error).toBeInstanceOf(ConnectorRuntimeToolCallError);
    expect(error).toMatchObject({
      code: "LINEAR_TOKEN_REFRESH_FAILED",
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "create_issue",
      routineId: "linear__create_issue",
      runtimeToolName: "linear__create_issue",
    });
    expect(markCurrentOrgConnectorConnectionErrorMock).toHaveBeenCalledWith(
      {},
      {
        clerkOrgId: "org_acme",
        provider: "linear",
      }
    );
    expect(logWarnMock).toHaveBeenCalledWith(
      "[connectors] connector connection error mark failed",
      expect.objectContaining({
        failure: {
          code: undefined,
          message: undefined,
          name: "Error",
        },
        provider: "linear",
        success: false,
      })
    );
    const logged = JSON.stringify(logWarnMock.mock.calls);
    expect(logged).not.toContain("mark connection secret");
    expect(logged).not.toContain("refresh token leaked raw details");
  });

  it("calls X bridge MCP with a short-lived Lightfast MCP token", async () => {
    const xConnection = connection({
      id: 42,
      mcpEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      provider: "x",
      providerWorkspaceId: null,
      providerWorkspaceName: "X",
      scopes: ["tweet.read", "users.read", "offline.access"],
      toolManifest: [{ name: "getUsersByUsername" }],
    });
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([xConnection]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(xConnection);

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });
    const result = await tool?.call({ username: "lightfast" });

    expect(result).toEqual({ content: [{ text: "x ok" }] });
    expect(getFreshLinearConnectorAccessTokenMock).not.toHaveBeenCalled();
    expect(callXBridgeMcpToolMock).toHaveBeenCalledWith({
      allowedEndpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      endpoint: "https://app.lightfast.localhost/api/connectors/x/mcp",
      input: { username: "lightfast" },
      mcpToken: expect.stringMatching(/^lfmcp_v1\./),
      name: "getUsersByUsername",
    });
    const callInput = callXBridgeMcpToolMock.mock.calls[0]?.[0];
    expect(JSON.stringify(callInput)).not.toContain("encrypted_x_access");
    expect(JSON.stringify(callInput)).not.toContain("x_access_token");
    expect(logInfoMock).toHaveBeenCalledWith(
      "[connectors] runtime tool call completed",
      expect.objectContaining({
        provider: "x",
        providerToolName: "getUsersByUsername",
        runtimeToolName: "x__getUsersByUsername",
        success: true,
      })
    );
  });

  it("rejects X runtime calls when the current manifest no longer has the tool", async () => {
    const staleXConnection = connection({
      id: 42,
      provider: "x",
      toolManifest: [{ name: "getUsersByUsername" }],
    });
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      staleXConnection,
    ]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({ id: 42, provider: "x", toolManifest: [] })
    );

    const [tool] = await loadConnectorRuntimeTools({ clerkOrgId: "org_acme" });

    await expect(tool?.call({ username: "lightfast" })).rejects.toThrow(
      "X connector is not active for automations."
    );
    expect(callXBridgeMcpToolMock).not.toHaveBeenCalled();
  });

  it("marks the X connector error when bridge auth terminally fails", async () => {
    const xConnection = connection({
      id: 42,
      provider: "x",
      toolManifest: [{ name: "getUsersMe" }],
    });
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([xConnection]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(xConnection);
    callXBridgeMcpToolMock.mockRejectedValue(
      new XAppNodeError(
        "X_TOKEN_REFRESH_FAILED",
        "refresh token leaked raw details"
      )
    );

    const [tool] = await loadConnectorRuntimeTools({
      automationPublicId: "aut_123",
      clerkOrgId: "org_acme",
      runPublicId: "run_123",
    });

    await expect(tool?.call({})).rejects.toThrow(
      "refresh token leaked raw details"
    );
    expect(markCurrentOrgConnectorConnectionErrorMock).toHaveBeenCalledWith(
      {},
      {
        clerkOrgId: "org_acme",
        provider: "x",
      }
    );
    expect(logWarnMock).toHaveBeenCalledWith(
      "[connectors] runtime tool call failed",
      expect.objectContaining({
        failure: {
          code: "X_TOKEN_REFRESH_FAILED",
          message: "X OAuth token refresh failed.",
          name: "XAppNodeError",
        },
        provider: "x",
        success: false,
      })
    );
    const logged = JSON.stringify(logWarnMock.mock.calls);
    expect(logged).not.toContain("refresh token leaked raw details");
  });
});

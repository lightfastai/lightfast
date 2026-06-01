import type { OrgConnectorConnection } from "@db/app";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listCurrentOrgConnectorConnectionsMock = vi.fn();
const getCurrentOrgConnectorConnectionMock = vi.fn();
const markCurrentOrgConnectorConnectionErrorMock = vi.fn();
const getFreshLinearConnectorAccessTokenMock = vi.fn();
const callLinearMcpToolMock = vi.fn();
const logInfoMock = vi.fn();
const logWarnMock = vi.fn();

vi.mock("@db/app/client", () => ({ db: {} }));

vi.mock("@db/app", () => ({
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  listCurrentOrgConnectorConnections: listCurrentOrgConnectorConnectionsMock,
  markCurrentOrgConnectorConnectionError:
    markCurrentOrgConnectorConnectionErrorMock,
}));

vi.mock("@repo/linear-app-node", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/linear-app-node")>();
  return {
    ...actual,
    callLinearMcpTool: callLinearMcpToolMock,
  };
});

vi.mock("../services/connectors/linear-flow", () => ({
  getFreshLinearConnectorAccessToken: getFreshLinearConnectorAccessTokenMock,
}));

vi.mock("@vendor/observability/log/next", () => ({
  log: {
    info: logInfoMock,
    warn: logWarnMock,
  },
}));

const { loadConnectorRuntimeTools } = await import(
  "../services/connectors/runtime"
);
const { LinearAppNodeError } = await import("@repo/linear-app-node");

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

describe("loadConnectorRuntimeTools", () => {
  beforeEach(() => {
    listCurrentOrgConnectorConnectionsMock.mockReset();
    getCurrentOrgConnectorConnectionMock.mockReset();
    markCurrentOrgConnectorConnectionErrorMock.mockReset();
    markCurrentOrgConnectorConnectionErrorMock.mockResolvedValue(undefined);
    getFreshLinearConnectorAccessTokenMock.mockReset();
    getFreshLinearConnectorAccessTokenMock.mockResolvedValue("lin_access");
    callLinearMcpToolMock.mockReset();
    callLinearMcpToolMock.mockResolvedValue({ content: [{ text: "ok" }] });
    logInfoMock.mockReset();
    logWarnMock.mockReset();
  });

  it("loads only active automation-enabled Linear connections and valid cached tools", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([
      connection(),
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

    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      description: "Create issue",
      provider: "linear",
      providerToolName: "create_issue",
      runtimeToolName: "linear__create_issue",
    });
    expect(listCurrentOrgConnectorConnectionsMock).toHaveBeenCalledWith(
      {},
      { clerkOrgId: "org_acme" }
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
  });

  it("calls Linear MCP with a fresh token and logs redacted success data", async () => {
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

  it("omits raw messages for non-Linear runtime failures", async () => {
    listCurrentOrgConnectorConnectionsMock.mockResolvedValue([connection()]);
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    callLinearMcpToolMock.mockRejectedValue(
      new Error("raw downstream secret")
    );

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
    expect(markCurrentOrgConnectorConnectionErrorMock).toHaveBeenCalledWith(
      {},
      {
        clerkOrgId: "org_acme",
        provider: "linear",
      }
    );
    expect(callLinearMcpToolMock).not.toHaveBeenCalled();
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
});

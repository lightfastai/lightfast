import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderRoutineServiceContext } from "../context";

const createProviderRoutineCallMock = vi.fn();
const getCurrentOrgConnectorConnectionMock = vi.fn();
const markCurrentOrgConnectorConnectionErrorMock = vi.fn();
const markProviderRoutineCallFailedMock = vi.fn();
const markProviderRoutineCallProviderAttemptedMock = vi.fn();
const markProviderRoutineCallSucceededMock = vi.fn();

vi.mock("@db/app", () => ({
  createProviderRoutineCall: createProviderRoutineCallMock,
  getCurrentOrgConnectorConnection: getCurrentOrgConnectorConnectionMock,
  markCurrentOrgConnectorConnectionError:
    markCurrentOrgConnectorConnectionErrorMock,
  markProviderRoutineCallFailed: markProviderRoutineCallFailedMock,
  markProviderRoutineCallProviderAttempted:
    markProviderRoutineCallProviderAttemptedMock,
  markProviderRoutineCallSucceeded: markProviderRoutineCallSucceededMock,
}));

const { callProviderRoutine } = await import("../call");

const now = new Date("2026-06-02T00:00:00.000Z");
const getAccessTokenMock = vi.fn();
const callToolMock = vi.fn();

function context(
  overrides: Partial<ProviderRoutineServiceContext> = {}
): ProviderRoutineServiceContext {
  return {
    actor: { orgId: "org_acme", userId: "user_123" },
    adapters: {
      linear: {
        callTool: callToolMock,
        getAccessToken: getAccessTokenMock,
      },
    },
    db: {} as ProviderRoutineServiceContext["db"],
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    now: () => now,
    scopes: { providerRoutineRead: true, providerRoutineWrite: true },
    source: {
      clientId: "mcp_client_123",
      ref: "grant_123",
      surface: "hosted_mcp",
    },
    ...overrides,
  };
}

function connection(overrides: Record<string, unknown> = {}) {
  return {
    clerkOrgId: "org_acme",
    enabledForAgents: true,
    id: 1,
    mcpEndpoint: "https://linear.test/mcp",
    provider: "linear",
    providerActorId: "actor_123",
    providerWorkspaceId: "workspace_123",
    status: "active",
    toolManifest: [
      {
        description: "List Linear issues",
        inputSchema: { type: "object" },
        name: "list_issues",
      },
      {
        description: "Create a Linear issue",
        inputSchema: {
          properties: { title: { type: "string" } },
          required: ["title"],
          type: "object",
        },
        name: "create_issue",
      },
    ],
    ...overrides,
  };
}

function errorWithCode(code: string) {
  return Object.assign(new Error(code), { code });
}

describe("callProviderRoutine", () => {
  beforeEach(() => {
    callToolMock.mockReset();
    createProviderRoutineCallMock.mockReset();
    createProviderRoutineCallMock.mockResolvedValue({
      publicId: "provider_routine_call_123",
    });
    getAccessTokenMock.mockReset();
    getAccessTokenMock.mockResolvedValue("linear_access_token");
    getCurrentOrgConnectorConnectionMock.mockReset();
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(connection());
    markCurrentOrgConnectorConnectionErrorMock.mockReset();
    markCurrentOrgConnectorConnectionErrorMock.mockResolvedValue(undefined);
    markProviderRoutineCallFailedMock.mockReset();
    markProviderRoutineCallFailedMock.mockResolvedValue(true);
    markProviderRoutineCallProviderAttemptedMock.mockReset();
    markProviderRoutineCallProviderAttemptedMock.mockResolvedValue(true);
    markProviderRoutineCallSucceededMock.mockReset();
    markProviderRoutineCallSucceededMock.mockResolvedValue(true);
  });

  it("does not create a ledger row for an unknown routine", async () => {
    await expect(
      callProviderRoutine(context(), {
        input: {},
        routineId: "linear__missing_tool",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_ROUTINE_NOT_FOUND" });

    expect(createProviderRoutineCallMock).not.toHaveBeenCalled();
  });

  it("does not create a ledger row for disabled providers", async () => {
    getCurrentOrgConnectorConnectionMock.mockResolvedValue(
      connection({ enabledForAgents: false })
    );

    await expect(
      callProviderRoutine(context(), {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_ROUTINE_NOT_ENABLED" });

    expect(createProviderRoutineCallMock).not.toHaveBeenCalled();
  });

  it("does not create a ledger row for invalid provider input", async () => {
    await expect(
      callProviderRoutine(context(), {
        input: {},
        routineId: "linear__create_issue",
      })
    ).rejects.toMatchObject({ code: "PROVIDER_ROUTINE_INVALID_INPUT" });

    expect(createProviderRoutineCallMock).not.toHaveBeenCalled();
  });

  it("records token refresh failures before providerAttempted is set", async () => {
    getAccessTokenMock.mockRejectedValue(
      errorWithCode("LINEAR_TOKEN_REFRESH_FAILED")
    );

    await expect(
      callProviderRoutine(context(), {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_AUTH_REQUIRED",
      providerRoutineCallId: "provider_routine_call_123",
    });

    expect(createProviderRoutineCallMock).toHaveBeenCalled();
    expect(markProviderRoutineCallProviderAttemptedMock).not.toHaveBeenCalled();
    expect(callToolMock).not.toHaveBeenCalled();
    expect(markProviderRoutineCallFailedMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        errorCode: "PROVIDER_ROUTINE_AUTH_REQUIRED",
        publicId: "provider_routine_call_123",
      })
    );
  });

  it("records provider failures after providerAttempted is set", async () => {
    callToolMock.mockRejectedValue(errorWithCode("LINEAR_MCP_FAILED"));

    await expect(
      callProviderRoutine(context(), {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_PROVIDER_FAILED",
      providerRoutineCallId: "provider_routine_call_123",
    });

    expect(markProviderRoutineCallProviderAttemptedMock).toHaveBeenCalledWith(
      {},
      {
        clerkOrgId: "org_acme",
        publicId: "provider_routine_call_123",
      }
    );
    expect(markProviderRoutineCallFailedMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        errorCode: "PROVIDER_ROUTINE_PROVIDER_FAILED",
        publicId: "provider_routine_call_123",
      })
    );
  });

  it("creates and completes a provider routine call on success", async () => {
    callToolMock.mockResolvedValue({ content: [{ text: "created" }] });

    await expect(
      callProviderRoutine(context(), {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      })
    ).resolves.toEqual({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "create_issue",
      result: { content: [{ text: "created" }] },
      routineId: "linear__create_issue",
      status: "succeeded",
    });

    expect(createProviderRoutineCallMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        calledById: "user_123",
        calledByKind: "user",
        calledByUserId: "user_123",
        clerkOrgId: "org_acme",
        providerConnectionId: 1,
        routineId: "linear__create_issue",
        sourceClientId: "mcp_client_123",
        sourceRef: "grant_123",
        sourceSurface: "hosted_mcp",
      })
    );
    expect(getAccessTokenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: expect.objectContaining({ id: 1 }),
      })
    );
    expect(callToolMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: "linear_access_token",
        input: { title: "Bug" },
        providerToolName: "create_issue",
      })
    );
    expect(markProviderRoutineCallSucceededMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        outputRedacted: { present: true },
        publicId: "provider_routine_call_123",
      })
    );
  });
});

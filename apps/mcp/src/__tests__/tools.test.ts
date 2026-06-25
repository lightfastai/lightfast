import { Client, InMemoryTransport, McpServer } from "@vendor/mcp";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HostedMcpContext } from "../context";
import {
  type ExecuteHostedMcpToolDependencies,
  executeHostedMcpTool,
  listHostedMcpTools,
  registerHostedMcpTools,
} from "../tools/execute";

const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";
const decisionId = "provider_routine_call_123";
const providerRoutineCallId = "provider_routine_call_123";
const decisionStartedAt = new Date("2026-06-01T00:00:00.000Z");
const decisionFinishedAt = new Date("2026-06-01T00:01:00.000Z");

const decisionSummary = {
  calledById: "automation_run_123",
  calledByKind: "automation",
  calledByUserId: null,
  classification: "write",
  createdAt: decisionStartedAt,
  errorCode: null,
  errorMessage: null,
  finishedAt: decisionFinishedAt,
  id: decisionId,
  provider: "linear",
  providerToolName: "create_issue",
  routineId: "linear__create_issue",
  snippet: "Linear / Create Issue succeeded from Automation",
  sourceSurface: "automation",
  startedAt: decisionStartedAt,
  status: "succeeded",
  title: "Create Issue",
} as const;

const decisionDetail = {
  ...decisionSummary,
  inputRedacted: { present: true },
  outputRedacted: { present: true },
  providerActorId: "actor_123",
  providerAttempted: true,
  providerConnectionId: 42,
  providerRoutineCallId: decisionId,
  providerWorkspaceId: "workspace_123",
  sourceClientId: "mcp_client_test",
  sourceRef: "mcp_grant_test",
  updatedAt: decisionFinishedAt,
} as const;

function context(overrides: Partial<HostedMcpContext> = {}): HostedMcpContext {
  return {
    clientId: "mcp_client_test",
    clientVerificationStatus: "verified",
    grantId: "mcp_grant_test",
    orgId: "org_test",
    requestId: "req_test",
    scopes: ["mcp:system:read", "mcp:signals:read", "mcp:signals:write"],
    userId: "user_test",
    ...overrides,
  };
}

function dependencies(
  overrides: Partial<ExecuteHostedMcpToolDependencies> = {}
): ExecuteHostedMcpToolDependencies {
  return {
    assertOrgAccess: vi.fn().mockResolvedValue(undefined),
    callProviderRoutine: vi.fn().mockResolvedValue({
      provider: "linear",
      providerRoutineCallId,
      providerToolName: "list_issues",
      result: { content: [{ text: "ok" }] },
      routineId: "linear__list_issues",
      status: "succeeded",
    }),
    createSignalForActor: vi.fn().mockResolvedValue({
      id: signalId,
      status: "queued",
      visibilityScope: "user",
    }),
    findDecisions: vi.fn().mockResolvedValue({
      items: [decisionSummary],
      nextCursor: null,
    }),
    findProviderRoutines: vi.fn().mockResolvedValue({
      routines: [
        {
          classification: "read",
          provider: "linear",
          providerToolName: "list_issues",
          routineId: "linear__list_issues",
          title: "List Issues",
        },
      ],
    }),
    getDecision: vi.fn().mockResolvedValue(decisionDetail),
    getSignalForActor: vi.fn().mockResolvedValue({
      classification: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      entityLinks: [],
      id: signalId,
      input: "Review this profile",
      status: "queued",
      updatedAt: "2026-06-01T00:01:00.000Z",
      visibilityScope: "user",
    }),
    now: vi.fn(() => new Date("2026-06-01T00:00:00.000Z")),
    recordMcpAuditEvent: vi.fn().mockResolvedValue(undefined),
    version: "0.1.0-test",
    ...overrides,
  };
}

describe("hosted MCP tools", () => {
  afterEach(() => {
    vi.doUnmock("@api/app/mcp-oauth");
    vi.doUnmock("../tools/app-audit-intake");
    vi.doUnmock("../tools/app-proxy-intake");
    vi.doUnmock("../tools/app-signal-intake");
  });

  it("lists policy-derived tools for an authenticated MCP request", () => {
    expect(listHostedMcpTools(context())).toEqual([
      expect.objectContaining({
        contractPath: "signals.create",
        name: "lightfast_signals_create",
        requiredScope: "mcp:signals:write",
      }),
      expect.objectContaining({
        contractPath: "signals.get",
        name: "lightfast_signals_get",
        requiredScope: "mcp:signals:read",
      }),
      expect.objectContaining({
        contractPath: "system.health",
        name: "lightfast_system_health",
        requiredScope: "mcp:system:read",
      }),
      expect.objectContaining({
        contractPath: "decisions.find",
        name: "decisions_find",
        requiredScope: "mcp:decisions:read",
      }),
      expect.objectContaining({
        contractPath: "decisions.get",
        name: "decisions_get",
        requiredScope: "mcp:decisions:read",
      }),
      expect.objectContaining({
        contractPath: "proxy.call",
        name: "proxy_call",
        requiredScope: "mcp:provider_routines:read",
      }),
      expect.objectContaining({
        contractPath: "proxy.find",
        name: "proxy_find",
        requiredScope: "mcp:provider_routines:read",
      }),
    ]);
  });

  it("serializes every hosted tool schema through MCP tools/list", async () => {
    const server = new McpServer({ name: "test", version: "0.0.0" });
    registerHostedMcpTools(server);

    const mcpClient = new Client({ name: "test-client", version: "0.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      mcpClient.connect(clientTransport),
    ]);

    try {
      const { tools } = await mcpClient.listTools();

      expect(tools.map((tool) => tool.name)).toEqual([
        "lightfast_signals_create",
        "lightfast_signals_get",
        "lightfast_system_health",
        "decisions_find",
        "decisions_get",
        "proxy_call",
        "proxy_find",
      ]);
      expect(
        tools.find((tool) => tool.name === "decisions_find")?.inputSchema
      ).toMatchObject({
        properties: {
          since: expect.objectContaining({
            format: "date-time",
            type: "string",
          }),
        },
        type: "object",
      });
    } finally {
      await mcpClient.close();
      await server.close();
    }
  });

  it("creates a signal with MCP actor attribution", async () => {
    const deps = dependencies();

    await expect(
      executeHostedMcpTool({
        context: context(),
        contractPath: "signals.create",
        dependencies: deps,
        rawInput: { input: "  Review this profile  " },
      })
    ).resolves.toEqual({
      id: signalId,
      status: "queued",
      visibilityScope: "user",
    });

    expect(deps.assertOrgAccess).toHaveBeenCalledWith({
      orgId: "org_test",
      userId: "user_test",
    });
    expect(deps.createSignalForActor).toHaveBeenCalledWith({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "Review this profile",
      scopes: ["mcp:signals:write"],
    });
  });

  it("gets a visible signal for the token org and user", async () => {
    const deps = dependencies();

    await expect(
      executeHostedMcpTool({
        context: context(),
        contractPath: "signals.get",
        dependencies: deps,
        rawInput: { id: signalId },
      })
    ).resolves.toEqual({
      classification: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      entityLinks: [],
      id: signalId,
      input: "Review this profile",
      status: "queued",
      updatedAt: "2026-06-01T00:01:00.000Z",
      visibilityScope: "user",
    });

    expect(deps.getSignalForActor).toHaveBeenCalledWith({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      id: signalId,
      scopes: ["mcp:signals:read"],
    });
  });

  it("rejects signals.create without mcp:signals:write", async () => {
    const deps = dependencies();

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:system:read", "mcp:signals:read"] }),
        contractPath: "signals.create",
        dependencies: deps,
        rawInput: { input: "Review this profile" },
      })
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      status: 403,
    });

    expect(deps.createSignalForActor).not.toHaveBeenCalled();
  });

  it("calls decisions_find with decision read scope", async () => {
    const deps = dependencies();

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:decisions:read"] }),
        contractPath: "decisions.find",
        dependencies: deps,
        rawInput: { query: "linear create" },
      })
    ).resolves.toEqual({
      items: [decisionSummary],
      nextCursor: null,
    });

    expect(deps.findDecisions).toHaveBeenCalledWith(
      {
        actor: {
          orgId: "org_test",
          scopes: ["mcp:decisions:read"],
          userId: "user_test",
        },
        scopes: {
          decisionRead: true,
        },
        source: {
          clientId: "mcp_client_test",
          ref: "mcp_grant_test",
          surface: "hosted_mcp",
        },
      },
      { query: "linear create" }
    );
  });

  it("calls decisions_get and returns full decision detail", async () => {
    const deps = dependencies();

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:decisions:read"] }),
        contractPath: "decisions.get",
        dependencies: deps,
        rawInput: { id: decisionId },
      })
    ).resolves.toEqual(decisionDetail);

    expect(deps.getDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          orgId: "org_test",
          scopes: ["mcp:decisions:read"],
          userId: "user_test",
        },
        scopes: {
          decisionRead: true,
        },
      }),
      { id: decisionId }
    );
  });

  it("rejects decisions_find without decision read scope", async () => {
    const deps = dependencies();

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:system:read"] }),
        contractPath: "decisions.find",
        dependencies: deps,
        rawInput: { query: "linear" },
      })
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      status: 403,
    });

    expect(deps.findDecisions).not.toHaveBeenCalled();
  });

  it("normalizes authorization status errors as org access denied", async () => {
    const deps = dependencies({
      assertOrgAccess: vi.fn().mockRejectedValue(
        Object.assign(new Error("Workspace access denied."), {
          code: "workspace_access_denied",
          status: 403,
        })
      ),
    });

    await expect(
      executeHostedMcpTool({
        context: context(),
        contractPath: "signals.create",
        dependencies: deps,
        rawInput: { input: "Review this profile" },
      })
    ).rejects.toMatchObject({
      code: "org_access_denied",
      message: "Workspace access denied.",
      status: 403,
    });

    expect(deps.recordMcpAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "denied",
        metadata: expect.objectContaining({
          error: {
            code: "org_access_denied",
            message: "Workspace access denied.",
          },
        }),
      })
    );
  });

  it("relabels non-authorization status errors as upstream_error", async () => {
    const deps = dependencies({
      assertOrgAccess: vi.fn().mockRejectedValue(
        Object.assign(new Error("Org service unavailable."), {
          code: "service_unavailable",
          status: 503,
        })
      ),
    });

    await expect(
      executeHostedMcpTool({
        context: context(),
        contractPath: "signals.create",
        dependencies: deps,
        rawInput: { input: "Review this profile" },
      })
    ).rejects.toMatchObject({
      code: "upstream_error",
      message: "Org service unavailable.",
      status: 503,
    });

    expect(deps.recordMcpAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: "error",
        metadata: expect.objectContaining({
          error: {
            code: "upstream_error",
            message: "Org service unavailable.",
          },
        }),
      })
    );
  });

  it("calls proxy_find with read provider-routine scope", async () => {
    const deps = dependencies();

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:provider_routines:read"] }),
        contractPath: "proxy.find",
        dependencies: deps,
        rawInput: { query: "issues" },
      })
    ).resolves.toEqual({
      routines: [
        {
          classification: "read",
          provider: "linear",
          providerToolName: "list_issues",
          routineId: "linear__list_issues",
          title: "List Issues",
        },
      ],
    });

    expect(deps.findProviderRoutines).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          orgId: "org_test",
          scopes: ["mcp:provider_routines:read"],
          userId: "user_test",
        }),
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: false,
        },
        source: {
          clientId: "mcp_client_test",
          ref: "mcp_grant_test",
          surface: "hosted_mcp",
        },
      }),
      { query: "issues" }
    );
  });

  it("lets write provider-routine scope discover read routines", async () => {
    const deps = dependencies();

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:provider_routines:write"] }),
        contractPath: "proxy.find",
        dependencies: deps,
        rawInput: { readOnly: true },
      })
    ).resolves.toEqual(
      expect.objectContaining({ routines: expect.any(Array) })
    );

    expect(deps.findProviderRoutines).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          scopes: ["mcp:provider_routines:write"],
        }),
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: true,
        },
      }),
      { readOnly: true }
    );
  });

  it("calls proxy_call and records provider routine call id in audit", async () => {
    const deps = dependencies();

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:provider_routines:read"] }),
        contractPath: "proxy.call",
        dependencies: deps,
        rawInput: {
          input: { query: "ABC" },
          routineId: "linear__list_issues",
        },
      })
    ).resolves.toEqual({
      provider: "linear",
      providerRoutineCallId,
      providerToolName: "list_issues",
      result: { content: [{ text: "ok" }] },
      routineId: "linear__list_issues",
      status: "succeeded",
    });

    expect(deps.callProviderRoutine).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          scopes: ["mcp:provider_routines:read"],
        }),
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: false,
        },
      }),
      {
        input: { query: "ABC" },
        routineId: "linear__list_issues",
      }
    );
    expect(deps.recordMcpAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "mcp.proxy.call",
        metadata: expect.objectContaining({
          providerRoutineCallId,
          toolName: "proxy_call",
        }),
      })
    );
  });

  it("maps provider routine scope failures from proxy_call", async () => {
    const deps = dependencies({
      callProviderRoutine: vi.fn().mockRejectedValue(
        Object.assign(new Error("Provider routine requires write scope."), {
          code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
        })
      ),
    });

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:provider_routines:read"] }),
        contractPath: "proxy.call",
        dependencies: deps,
        rawInput: {
          input: { title: "Bug" },
          routineId: "linear__create_issue",
        },
      })
    ).rejects.toMatchObject({
      code: "insufficient_scope",
      status: 403,
    });
  });

  it("does not load unrelated default dependencies for system health", async () => {
    const recordMcpAuditEvent = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../tools/app-audit-intake", () => ({
      recordMcpAuditEventViaApp: recordMcpAuditEvent,
    }));
    vi.doMock("@api/app/mcp-oauth", () => {
      throw new Error("mcp-oauth should not load for system health");
    });
    vi.doMock("../tools/app-signal-intake", () => {
      throw new Error("app signal intake should not load for system health");
    });

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:system:read"] }),
        contractPath: "system.health",
        rawInput: undefined,
      })
    ).resolves.toMatchObject({
      status: "ok",
      version: "0.1.0",
    });

    expect(recordMcpAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "mcp.system.health",
        outcome: "success",
      })
    );
  });

  it("does not load app OAuth for signal creation", async () => {
    const createSignalForActor = vi.fn().mockResolvedValue({
      id: signalId,
      status: "queued",
      visibilityScope: "user",
    });
    const recordMcpAuditEvent = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../tools/app-audit-intake", () => ({
      recordMcpAuditEventViaApp: recordMcpAuditEvent,
    }));
    vi.doMock("@api/app/mcp-oauth", () => {
      throw new Error("mcp-oauth should not load for signal creation");
    });
    vi.doMock("../tools/app-signal-intake", () => ({
      createSignalForActorViaApp: createSignalForActor,
    }));

    await expect(
      executeHostedMcpTool({
        context: context(),
        contractPath: "signals.create",
        rawInput: { input: "Remember this production MCP test" },
      })
    ).resolves.toEqual({
      id: signalId,
      status: "queued",
      visibilityScope: "user",
    });

    expect(createSignalForActor).toHaveBeenCalledWith({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "Remember this production MCP test",
      scopes: ["mcp:signals:write"],
    });
  });

  it("does not load OAuth defaults for signal get", async () => {
    const getSignalForActor = vi.fn().mockResolvedValue({
      classification: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      entityLinks: [],
      id: signalId,
      input: "Review this profile",
      status: "queued",
      updatedAt: "2026-06-01T00:01:00.000Z",
      visibilityScope: "user",
    });
    const recordMcpAuditEvent = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../tools/app-audit-intake", () => ({
      recordMcpAuditEventViaApp: recordMcpAuditEvent,
    }));
    vi.doMock("@api/app/mcp-oauth", () => {
      throw new Error("mcp-oauth should not load for signal get");
    });
    vi.doMock("../tools/app-signal-intake", () => ({
      getSignalForActorViaApp: getSignalForActor,
    }));

    await expect(
      executeHostedMcpTool({
        context: context(),
        contractPath: "signals.get",
        rawInput: { id: signalId },
      })
    ).resolves.toMatchObject({
      id: signalId,
      status: "queued",
    });

    expect(getSignalForActor).toHaveBeenCalledWith({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      id: signalId,
      scopes: ["mcp:signals:read"],
    });
  });

  it("does not load app OAuth and uses app proxy intake for proxy calls", async () => {
    const callProviderRoutine = vi.fn().mockResolvedValue({
      provider: "linear",
      providerRoutineCallId,
      providerToolName: "list_issues",
      result: { content: [{ text: "ok" }] },
      routineId: "linear__list_issues",
      status: "succeeded",
    });
    const findProviderRoutines = vi.fn();
    const recordMcpAuditEvent = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../tools/app-audit-intake", () => ({
      recordMcpAuditEventViaApp: recordMcpAuditEvent,
    }));
    vi.doMock("@api/app/mcp-oauth", () => {
      throw new Error("mcp-oauth should not load for proxy calls");
    });
    vi.doMock("../tools/app-signal-intake", () => {
      throw new Error("app signal intake should not load for proxy calls");
    });
    vi.doMock("../tools/app-proxy-intake", () => ({
      callProviderRoutineViaApp: callProviderRoutine,
      findProviderRoutinesViaApp: findProviderRoutines,
    }));

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:provider_routines:read"] }),
        contractPath: "proxy.call",
        rawInput: {
          input: { query: "ABC" },
          routineId: "linear__list_issues",
        },
      })
    ).resolves.toMatchObject({
      providerRoutineCallId,
      status: "succeeded",
    });

    expect(callProviderRoutine).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          orgId: "org_test",
          scopes: ["mcp:provider_routines:read"],
          userId: "user_test",
        }),
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: false,
        },
      }),
      {
        input: { query: "ABC" },
        routineId: "linear__list_issues",
      }
    );
  });

  it("does not load app OAuth or proxy intake for decision tools", async () => {
    const findDecisions = vi.fn().mockResolvedValue({
      items: [decisionSummary],
      nextCursor: null,
    });
    const getDecision = vi.fn();
    const recordMcpAuditEvent = vi.fn().mockResolvedValue(undefined);

    vi.doMock("../tools/app-audit-intake", () => ({
      recordMcpAuditEventViaApp: recordMcpAuditEvent,
    }));
    vi.doMock("@api/app/mcp-oauth", () => {
      throw new Error("mcp-oauth should not load for decision tools");
    });
    vi.doMock("../tools/app-proxy-intake", () => {
      throw new Error("app proxy intake should not load for decision tools");
    });
    vi.doMock("../tools/app-signal-intake", () => {
      throw new Error("app signal intake should not load for decision tools");
    });
    vi.doMock("../tools/app-decision-intake", () => ({
      findDecisionsViaApp: findDecisions,
      getDecisionViaApp: getDecision,
    }));

    await expect(
      executeHostedMcpTool({
        context: context({ scopes: ["mcp:decisions:read"] }),
        contractPath: "decisions.find",
        rawInput: { query: "linear create" },
      })
    ).resolves.toEqual({
      items: [decisionSummary],
      nextCursor: null,
    });

    expect(findDecisions).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: {
          orgId: "org_test",
          scopes: ["mcp:decisions:read"],
          userId: "user_test",
        },
        scopes: {
          decisionRead: true,
        },
      }),
      { query: "linear create" }
    );
  });
});

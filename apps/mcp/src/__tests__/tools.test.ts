import type { Database, Signal } from "@db/app";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HostedMcpContext } from "../context";
import {
  type ExecuteHostedMcpToolDependencies,
  executeHostedMcpTool,
  listHostedMcpTools,
} from "../tools/execute";

const db = { kind: "mock-db" } as unknown as Database;
const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";
const providerRoutineCallId = "provider_routine_call_123";

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

function signal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: 1,
    classification: null,
    classificationMetadata: null,
    clerkOrgId: "org_test",
    createdAt: new Date("2026-06-01T00:00:00.000Z"),
    createdByApiKeyId: null,
    createdByMcpClientId: "mcp_client_test",
    createdByMcpGrantId: "mcp_grant_test",
    createdByUserId: "user_test",
    errorCode: null,
    errorMessage: null,
    input: "Review this profile",
    publicId: signalId,
    status: "queued",
    updatedAt: new Date("2026-06-01T00:01:00.000Z"),
    visibilityScope: "user",
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
    db,
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
    getVisibleSignalByPublicId: vi.fn().mockResolvedValue(signal()),
    now: vi.fn(() => new Date("2026-06-01T00:00:00.000Z")),
    recordMcpAuditEvent: vi.fn().mockResolvedValue(undefined),
    version: "0.1.0-test",
    ...overrides,
  };
}

describe("hosted MCP tools", () => {
  afterEach(() => {
    vi.doUnmock("@api/app/mcp-oauth");
    vi.doUnmock("@api/app/signals/service");
    vi.doUnmock("@db/app");
    vi.doUnmock("@repo/provider-routines");
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

    expect(deps.assertOrgAccess).toHaveBeenCalledWith(db, {
      orgId: "org_test",
      userId: "user_test",
    });
    expect(deps.createSignalForActor).toHaveBeenCalledWith(db, {
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "Review this profile",
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
      id: signalId,
      input: "Review this profile",
      status: "queued",
      updatedAt: "2026-06-01T00:01:00.000Z",
      visibilityScope: "user",
    });

    expect(deps.getVisibleSignalByPublicId).toHaveBeenCalledWith(db, {
      clerkOrgId: "org_test",
      createdByUserId: "user_test",
      publicId: signalId,
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
      db,
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
      db,
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
        actor: { orgId: "org_test", userId: "user_test" },
        db,
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
      db,
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

    vi.doMock("@db/app", () => ({
      db,
      getVisibleSignalByPublicId: vi.fn(),
      recordMcpAuditEvent,
    }));
    vi.doMock("@api/app/mcp-oauth", () => {
      throw new Error("mcp-oauth should not load for system health");
    });
    vi.doMock("@api/app/signals/service", () => {
      throw new Error("signal service should not load for system health");
    });
    vi.doMock("../tools/app-signal-intake", () => {
      throw new Error("app signal intake should not load for system health");
    });
    vi.doMock("@repo/provider-routines", () => {
      throw new Error("provider routines should not load for system health");
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
      db,
      expect.objectContaining({
        eventName: "mcp.system.health",
        outcome: "success",
      })
    );
  });

  it("does not load app signal service or provider routine defaults for signal creation", async () => {
    const assertHostedMcpOrgAccess = vi.fn().mockResolvedValue(undefined);
    const createSignalForActor = vi.fn().mockResolvedValue({
      id: signalId,
      status: "queued",
      visibilityScope: "user",
    });
    const recordMcpAuditEvent = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@db/app", () => ({
      db,
      getVisibleSignalByPublicId: vi.fn(),
      recordMcpAuditEvent,
    }));
    vi.doMock("@api/app/mcp-oauth", () => ({
      assertHostedMcpOrgAccess,
    }));
    vi.doMock("@api/app/signals/service", () => {
      throw new Error("signal service should not load for signal creation");
    });
    vi.doMock("../tools/app-signal-intake", () => ({
      createSignalForActorViaApp: createSignalForActor,
    }));
    vi.doMock("@repo/provider-routines", () => {
      throw new Error("provider routines should not load for signal creation");
    });

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

    expect(assertHostedMcpOrgAccess).toHaveBeenCalledWith(db, {
      orgId: "org_test",
      userId: "user_test",
    });
    expect(createSignalForActor).toHaveBeenCalledWith(db, {
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      input: "Remember this production MCP test",
    });
  });
});

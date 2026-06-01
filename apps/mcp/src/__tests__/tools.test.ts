import type { Database, Signal } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import type { HostedMcpContext } from "../context";
import {
  type ExecuteHostedMcpToolDependencies,
  executeHostedMcpTool,
  listHostedMcpTools,
} from "../tools/execute";

const db = { kind: "mock-db" } as unknown as Database;
const signalId = "signal_123e4567-e89b-12d3-a456-426614174000";

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
    createSignalForActor: vi.fn().mockResolvedValue({
      id: signalId,
      status: "queued",
      visibilityScope: "user",
    }),
    db,
    getVisibleSignalByPublicId: vi.fn().mockResolvedValue(signal()),
    now: vi.fn(() => new Date("2026-06-01T00:00:00.000Z")),
    recordMcpAuditEvent: vi.fn().mockResolvedValue(undefined),
    version: "0.1.0-test",
    ...overrides,
  };
}

describe("hosted MCP tools", () => {
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
});

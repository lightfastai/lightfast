import type { Database } from "@db/app";
import { describe, expect, it, vi } from "vitest";

import type { HostedMcpContext } from "../context";
import {
  type ExecuteHostedMcpToolDependencies,
  executeHostedMcpTool,
} from "../tools/execute";

const db = { kind: "mock-db" } as unknown as Database;

const context = {
  clientId: "mcp_client_test",
  clientVerificationStatus: "verified",
  grantId: "mcp_grant_test",
  orgId: "org_test",
  requestId: "req_test",
  scopes: ["mcp:system:read"],
  userId: "user_test",
} satisfies HostedMcpContext;

function dependencies(): ExecuteHostedMcpToolDependencies {
  return {
    assertOrgAccess: vi.fn().mockResolvedValue(undefined),
    callProviderRoutine: vi.fn().mockResolvedValue({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "list_issues",
      result: { content: [{ text: "ok" }] },
      routineId: "linear__list_issues",
      status: "succeeded",
    }),
    createSignalForActor: vi.fn(),
    db,
    findProviderRoutines: vi.fn(),
    getVisibleSignalByPublicId: vi.fn(),
    now: vi
      .fn()
      .mockReturnValueOnce(new Date("2026-06-01T00:00:00.000Z"))
      .mockReturnValueOnce(new Date("2026-06-01T00:00:00.005Z"))
      .mockReturnValueOnce(new Date("2026-06-01T00:00:00.025Z"))
      .mockReturnValueOnce(new Date("2026-06-01T00:01:00.000Z"))
      .mockReturnValueOnce(new Date("2026-06-01T00:01:00.010Z")),
    recordMcpAuditEvent: vi.fn().mockResolvedValue(undefined),
    version: "0.1.0-test",
  };
}

describe("hosted MCP audit", () => {
  it("records a redacted audit event for success and failure", async () => {
    const deps = dependencies();

    await executeHostedMcpTool({
      context,
      contractPath: "system.health",
      dependencies: deps,
      rawInput: { accessToken: "secret-token-that-must-not-be-stored" },
    });

    await expect(
      executeHostedMcpTool({
        context: { ...context, scopes: [] },
        contractPath: "system.health",
        dependencies: deps,
        rawInput: { accessToken: "another-secret-token" },
      })
    ).rejects.toMatchObject({
      code: "insufficient_scope",
    });

    expect(deps.recordMcpAuditEvent).toHaveBeenCalledTimes(2);
    expect(deps.recordMcpAuditEvent).toHaveBeenNthCalledWith(
      1,
      db,
      expect.objectContaining({
        clientPublicId: "mcp_client_test",
        clerkOrgId: "org_test",
        clerkUserId: "user_test",
        eventName: "mcp.system.health",
        grantPublicId: "mcp_grant_test",
        outcome: "success",
        metadata: expect.objectContaining({
          clientVerificationStatus: "verified",
          contractPath: "system.health",
          latencyMs: 25,
          requestId: "req_test",
          scopes: ["mcp:system:read"],
          toolName: "lightfast_system_health",
        }),
      })
    );
    expect(deps.recordMcpAuditEvent).toHaveBeenNthCalledWith(
      2,
      db,
      expect.objectContaining({
        outcome: "denied",
        metadata: expect.objectContaining({
          error: {
            code: "insufficient_scope",
            message: "MCP token is missing required scope mcp:system:read.",
          },
          latencyMs: 10,
        }),
      })
    );

    const auditPayload = JSON.stringify(
      (deps.recordMcpAuditEvent as ReturnType<typeof vi.fn>).mock.calls
    );
    expect(auditPayload).not.toContain("secret-token");
    expect(auditPayload).not.toContain("rawInput");
    expect(auditPayload).not.toContain("structuredContent");
  });

  it("links proxy_call audit events to provider routine call ids", async () => {
    const deps = dependencies();

    await executeHostedMcpTool({
      context: {
        ...context,
        scopes: ["mcp:provider_routines:read"],
      },
      contractPath: "proxy.call",
      dependencies: deps,
      rawInput: {
        input: { query: "secret-query" },
        routineId: "linear__list_issues",
      },
    });

    expect(deps.recordMcpAuditEvent).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        eventName: "mcp.proxy.call",
        metadata: expect.objectContaining({
          providerRoutineCallId: "provider_routine_call_123",
        }),
      })
    );
    const auditPayload = JSON.stringify(
      (deps.recordMcpAuditEvent as ReturnType<typeof vi.fn>).mock.calls
    );
    expect(auditPayload).not.toContain("secret-query");
  });
});

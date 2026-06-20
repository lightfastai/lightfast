import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "../domain";
import {
  type ProviderRoutineCommandDeps,
  providerRoutineCallCommand,
  providerRoutineFindCommand,
} from "../domain/provider-routines";

const mocks = vi.hoisted(() => ({
  callProviderRoutine: vi.fn(),
  findProviderRoutines: vi.fn(),
  loadConnectorRuntimeTools: vi.fn(),
}));

const db = { kind: "db" } as unknown as ProviderRoutineCommandDeps["db"];
const log = {
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
};
const now = () => new Date("2026-06-16T00:00:00.000Z");

function deps(): ProviderRoutineCommandDeps {
  return {
    callProviderRoutine: mocks.callProviderRoutine,
    db,
    findProviderRoutines: mocks.findProviderRoutines,
    loadConnectorRuntimeTools: mocks.loadConnectorRuntimeTools,
    log,
    now,
  };
}

const cliCtx = {
  actor: {
    client: "cli" as const,
    clientId: "cli_client_test",
    kind: "nativeClient" as const,
    orgId: "org_test",
    source: "cli" as const,
    userId: "user_test",
  },
  caller: { client: "cli" as const, kind: "firstPartyClient" as const },
  request: { id: "req_cli_test", source: "cli-rpc" as const },
} satisfies ExecutionContext;

const mcpCtx = {
  actor: {
    clientId: "mcp_client_test",
    grantId: "mcp_grant_test",
    kind: "mcpClient" as const,
    orgId: "org_test",
    scopes: ["mcp:provider_routines:read"],
    userId: "user_test",
  },
  caller: { kind: "service" as const, service: "apps-mcp" as const },
  request: { id: "req_mcp_test", source: "mcp" as const },
} satisfies ExecutionContext;

describe("provider routine domain commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findProviderRoutines.mockResolvedValue({ routines: [] });
    mocks.callProviderRoutine.mockResolvedValue({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "create_issue",
      result: { id: "issue_123" },
      routineId: "linear__create_issue",
      status: "succeeded",
    });
    mocks.loadConnectorRuntimeTools.mockResolvedValue([]);
  });

  it("finds provider routines for the CLI through native-client authority", async () => {
    await expect(
      providerRoutineFindCommand.run({
        ctx: cliCtx,
        deps: deps(),
        input: { input: { includeSchema: true, query: "issue" } },
      })
    ).resolves.toEqual({ routines: [] });

    expect(mocks.findProviderRoutines).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { orgId: "org_test", userId: "user_test" },
        db,
        log,
        scopes: {
          providerRoutineRead: true,
          providerRoutineWrite: true,
        },
        source: {
          clientId: "cli_client_test",
          ref: "org_test",
          surface: "native_cli",
        },
      }),
      { includeSchema: true, query: "issue" }
    );

    const serviceContext = mocks.findProviderRoutines.mock.calls[0]?.[0];
    await expect(
      serviceContext.adapters.connectors.loadTools()
    ).resolves.toEqual([]);
    expect(mocks.loadConnectorRuntimeTools).toHaveBeenCalledWith({
      calledByUserId: "user_test",
      clerkOrgId: "org_test",
      sourceClientId: "cli_client_test",
      sourceRef: "org_test",
      sourceSurface: "native_cli",
    });
  });

  it("calls provider routines for hosted MCP using the delegated scope context", async () => {
    await expect(
      providerRoutineCallCommand.run({
        ctx: mcpCtx,
        deps: deps(),
        input: {
          input: {
            input: { title: "Bug" },
            routineId: "linear__create_issue",
          },
          scopes: {
            providerRoutineRead: true,
            providerRoutineWrite: false,
          },
        },
      })
    ).resolves.toMatchObject({
      providerRoutineCallId: "provider_routine_call_123",
      status: "succeeded",
    });

    expect(mocks.callProviderRoutine).toHaveBeenCalledWith(
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
      {
        input: { title: "Bug" },
        routineId: "linear__create_issue",
      }
    );

    const serviceContext = mocks.callProviderRoutine.mock.calls[0]?.[0];
    await serviceContext.adapters.connectors.loadTools();
    expect(mocks.loadConnectorRuntimeTools).toHaveBeenCalledWith({
      calledByUserId: "user_test",
      clerkOrgId: "org_test",
      sourceClientId: "mcp_client_test",
      sourceRef: "mcp_grant_test",
      sourceSurface: "hosted_mcp",
    });
  });

  it("rejects hosted MCP provider routines without the apps-mcp service caller", async () => {
    await expect(
      providerRoutineFindCommand.run({
        ctx: {
          actor: mcpCtx.actor,
          request: mcpCtx.request,
        },
        deps: deps(),
        input: {
          input: {},
          scopes: {
            providerRoutineRead: true,
            providerRoutineWrite: false,
          },
        },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "MCP_SERVICE_CALLER_REQUIRED",
        kind: "authz",
      })
    );

    expect(mocks.findProviderRoutines).not.toHaveBeenCalled();
  });

  it("rejects hosted MCP provider routine scope escalation", async () => {
    await expect(
      providerRoutineCallCommand.run({
        ctx: mcpCtx,
        deps: deps(),
        input: {
          input: {
            input: { title: "Bug" },
            routineId: "linear__create_issue",
          },
          scopes: {
            providerRoutineRead: true,
            providerRoutineWrite: true,
          },
        },
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: "MCP_PROVIDER_ROUTINE_SCOPE_REQUIRED",
        kind: "authz",
      })
    );

    expect(mocks.callProviderRoutine).not.toHaveBeenCalled();
  });
});

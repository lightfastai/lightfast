import { signServiceJWT } from "@api/app/service-jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";

const assertHostedMcpOrgAccessMock = vi.fn();
const callProviderRoutineMock = vi.fn();
const findProviderRoutinesMock = vi.fn();

vi.mock("@api/app/mcp-oauth/resource-access", () => ({
  assertHostedMcpOrgAccess: assertHostedMcpOrgAccessMock,
}));

vi.mock("@repo/provider-routines", () => ({
  callProviderRoutine: callProviderRoutineMock,
  findProviderRoutines: findProviderRoutinesMock,
}));

vi.mock("@db/app/client", () => ({
  db: { kind: "mock-db" },
}));

vi.mock("~/env", () => ({
  env: {
    SERVICE_JWT_SECRET: "test-service-jwt-secret-at-least-32-chars",
  },
}));

const jwtSecret = "test-service-jwt-secret-at-least-32-chars";

async function token(
  input: { audience?: "lightfast-app"; caller?: "app" | "mcp" } = {}
) {
  return await signServiceJWT({
    audience: input.audience ?? "lightfast-app",
    caller: input.caller ?? "mcp",
    jwtSecret,
  });
}

function proxyCommand(input: { input: unknown }) {
  return {
    actor: {
      clientId: "mcp_client_test",
      grantId: "mcp_grant_test",
      kind: "mcp",
      orgId: "org_test",
      userId: "user_test",
    },
    input: input.input,
    scopes: {
      providerRoutineRead: true,
      providerRoutineWrite: false,
    },
  };
}

function request(
  pathname: string,
  body: unknown,
  bearerToken?: string
): Request {
  return new Request(`https://lightfast.ai${pathname}`, {
    body: JSON.stringify(body),
    headers: {
      ...(bearerToken ? { authorization: `Bearer ${bearerToken}` } : {}),
      "content-type": "application/json",
    },
    method: "POST",
  });
}

describe("internal MCP proxy route", () => {
  beforeEach(() => {
    assertHostedMcpOrgAccessMock.mockReset();
    assertHostedMcpOrgAccessMock.mockResolvedValue(undefined);
    callProviderRoutineMock.mockReset();
    findProviderRoutinesMock.mockReset();
  });

  it("rejects missing service bearer tokens", async () => {
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/proxy/find/route"
    );

    const res = await POST(
      request("/api/internal/mcp/proxy/find", proxyCommand({ input: {} }))
    );

    expect(res.status).toBe(401);
    expect(findProviderRoutinesMock).not.toHaveBeenCalled();
  });

  it("finds provider routines after checking app-side organization access", async () => {
    findProviderRoutinesMock.mockResolvedValueOnce({
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
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/proxy/find/route"
    );

    const res = await POST(
      request(
        "/api/internal/mcp/proxy/find",
        proxyCommand({ input: { query: "issues" } }),
        await token()
      )
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
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
    expect(assertHostedMcpOrgAccessMock).toHaveBeenCalledWith(
      { kind: "mock-db" },
      {
        orgId: "org_test",
        userId: "user_test",
      }
    );
    expect(findProviderRoutinesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { orgId: "org_test", userId: "user_test" },
        db: { kind: "mock-db" },
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

  it("calls provider routines through the app boundary", async () => {
    callProviderRoutineMock.mockResolvedValueOnce({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "list_issues",
      result: { content: [{ text: "ok" }] },
      routineId: "linear__list_issues",
      status: "succeeded",
    });
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/proxy/call/route"
    );

    const res = await POST(
      request(
        "/api/internal/mcp/proxy/call",
        proxyCommand({
          input: {
            input: { query: "ABC" },
            routineId: "linear__list_issues",
          },
        }),
        await token()
      )
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "list_issues",
      result: { content: [{ text: "ok" }] },
      routineId: "linear__list_issues",
      status: "succeeded",
    });
    expect(callProviderRoutineMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: { orgId: "org_test", userId: "user_test" },
        source: {
          clientId: "mcp_client_test",
          ref: "mcp_grant_test",
          surface: "hosted_mcp",
        },
      }),
      {
        input: { query: "ABC" },
        routineId: "linear__list_issues",
      }
    );
  });

  it("preserves provider routine failures for hosted MCP", async () => {
    callProviderRoutineMock.mockRejectedValueOnce(
      Object.assign(new Error("Provider routine requires additional scope."), {
        code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
        routineId: "linear__create_issue",
      })
    );
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/proxy/call/route"
    );

    const res = await POST(
      request(
        "/api/internal/mcp/proxy/call",
        proxyCommand({
          input: {
            input: { title: "Bug" },
            routineId: "linear__create_issue",
          },
        }),
        await token()
      )
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      message: "Provider routine requires additional scope.",
      routineId: "linear__create_issue",
    });
  });

  it("rejects app-side organization access failures before proxy execution", async () => {
    assertHostedMcpOrgAccessMock.mockRejectedValueOnce(
      Object.assign(new Error("MCP organization is not connected."), {
        status: 403,
      })
    );
    const { POST } = await import(
      "~/app/(internal)/api/internal/mcp/proxy/call/route"
    );

    const res = await POST(
      request(
        "/api/internal/mcp/proxy/call",
        proxyCommand({
          input: {
            input: { query: "ABC" },
            routineId: "linear__list_issues",
          },
        }),
        await token()
      )
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({
      error: "org_access_denied",
      message: "MCP organization is not connected.",
    });
    expect(callProviderRoutineMock).not.toHaveBeenCalled();
  });
});

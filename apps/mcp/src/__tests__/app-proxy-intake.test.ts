import { jwtVerify } from "@vendor/jose";
import { afterEach, describe, expect, it, vi } from "vitest";

const jwtSecret = "test-service-jwt-secret-at-least-32-chars";

async function importAdapter() {
  vi.stubEnv("APP_INTERNAL_URL", "https://app-internal.lightfast.ai");
  vi.stubEnv("MCP_AUTH_ISSUER", "https://issuer.lightfast.ai");
  vi.stubEnv("MCP_RESOURCE_URL", "https://mcp.lightfast.ai/mcp");
  vi.stubEnv("SERVICE_JWT_SECRET", jwtSecret);
  return await import("../tools/app-proxy-intake");
}

const proxyContext = {
  actor: {
    orgId: "org_test",
    userId: "user_test",
  },
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  now: () => new Date("2026-06-01T00:00:00.000Z"),
  scopes: {
    providerRoutineRead: true,
    providerRoutineWrite: false,
  },
  source: {
    clientId: "mcp_client_test",
    ref: "mcp_grant_test",
    surface: "hosted_mcp",
  },
} as const;

describe("app proxy intake adapter", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("posts MCP proxy find commands to the app with service auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        routines: [
          {
            classification: "read",
            provider: "linear",
            providerToolName: "list_issues",
            routineId: "linear__list_issues",
            title: "List Issues",
          },
        ],
      })
    );
    const { findProviderRoutinesViaApp } = await importAdapter();

    await expect(
      findProviderRoutinesViaApp(
        proxyContext,
        { query: "issues" },
        { fetch: fetchMock }
      )
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

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app-internal.lightfast.ai/api/internal/mcp/proxy/find",
      expect.objectContaining({
        method: "POST",
      })
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const authorization = (init.headers as Record<string, string>)
      .authorization;
    const bearer = authorization!.replace(/^Bearer\s+/, "");
    const { payload } = await jwtVerify(
      bearer,
      new TextEncoder().encode(jwtSecret),
      { audience: "lightfast-app" }
    );
    expect(payload).toMatchObject({
      iss: "mcp",
      token_use: "service_access",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      input: {
        query: "issues",
      },
      scopes: {
        providerRoutineRead: true,
        providerRoutineWrite: false,
      },
    });
  });

  it("posts MCP proxy call commands to the app", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        provider: "linear",
        providerRoutineCallId: "provider_routine_call_123",
        providerToolName: "list_issues",
        result: { content: [{ text: "ok" }] },
        routineId: "linear__list_issues",
        status: "succeeded",
      })
    );
    const { callProviderRoutineViaApp } = await importAdapter();

    await expect(
      callProviderRoutineViaApp(
        proxyContext,
        {
          input: { query: "ABC" },
          routineId: "linear__list_issues",
        },
        { fetch: fetchMock }
      )
    ).resolves.toEqual({
      provider: "linear",
      providerRoutineCallId: "provider_routine_call_123",
      providerToolName: "list_issues",
      result: { content: [{ text: "ok" }] },
      routineId: "linear__list_issues",
      status: "succeeded",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app-internal.lightfast.ai/api/internal/mcp/proxy/call",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("preserves app-side provider routine failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
          message: "Provider routine requires additional scope.",
        },
        { status: 403 }
      )
    );
    const { callProviderRoutineViaApp } = await importAdapter();

    await expect(
      callProviderRoutineViaApp(
        proxyContext,
        {
          input: { title: "Bug" },
          routineId: "linear__create_issue",
        },
        { fetch: fetchMock }
      )
    ).rejects.toMatchObject({
      code: "PROVIDER_ROUTINE_INSUFFICIENT_SCOPE",
      status: 403,
    });
  });
});

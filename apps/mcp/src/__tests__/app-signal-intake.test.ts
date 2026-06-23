import { jwtVerify } from "@vendor/jose";
import { afterEach, describe, expect, it, vi } from "vitest";

const jwtSecret = "test-service-jwt-secret-at-least-32-chars";

async function importAdapter() {
  vi.stubEnv("APP_INTERNAL_URL", "https://app-internal.lightfast.ai");
  vi.stubEnv("MCP_AUTH_ISSUER", "https://issuer.lightfast.ai");
  vi.stubEnv("MCP_RESOURCE_URL", "https://mcp.lightfast.ai/mcp");
  vi.stubEnv("SERVICE_JWT_SECRET", jwtSecret);
  return await import("../tools/app-signal-intake");
}

describe("app signal intake adapter", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("posts MCP signal commands to the app with a service JWT", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "signal_123e4567-e89b-12d3-a456-426614174000",
          status: "queued",
          visibilityScope: "user",
        }),
        { status: 200 }
      )
    );
    const { createSignalForActorViaApp } = await importAdapter();

    await expect(
      createSignalForActorViaApp(
        {
          actor: {
            clientId: "mcp_client_test",
            grantId: "mcp_grant_test",
            kind: "mcp",
            orgId: "org_test",
            userId: "user_test",
          },
          input: "Signal from MCP",
          scopes: ["mcp:signals:write"],
        },
        { fetch: fetchMock }
      )
    ).resolves.toEqual({
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      status: "queued",
      visibilityScope: "user",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app-internal.lightfast.ai/api/internal/mcp/signals",
      expect.objectContaining({
        method: "POST",
      })
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const authorization = (init.headers as Record<string, string>)
      .authorization;
    expect(authorization).toBeDefined();
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
      input: "Signal from MCP",
      scopes: ["mcp:signals:write"],
    });
  });

  it("throws a stable upstream error for non-2xx app responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: "signal_enqueue_failed",
          message: "Failed to queue signal.",
        },
        { status: 500 }
      )
    );
    const { createSignalForActorViaApp } = await importAdapter();

    await expect(
      createSignalForActorViaApp(
        {
          actor: {
            clientId: "mcp_client_test",
            grantId: "mcp_grant_test",
            kind: "mcp",
            orgId: "org_test",
            userId: "user_test",
          },
          input: "Signal from MCP",
          scopes: ["mcp:signals:write"],
        },
        { fetch: fetchMock }
      )
    ).rejects.toMatchObject({
      code: "app_signal_intake_failed",
      status: 502,
    });
  });

  it("preserves app-side authorization failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: "org_access_denied",
          message: "MCP organization is not connected.",
        },
        { status: 403 }
      )
    );
    const { createSignalForActorViaApp } = await importAdapter();

    await expect(
      createSignalForActorViaApp(
        {
          actor: {
            clientId: "mcp_client_test",
            grantId: "mcp_grant_test",
            kind: "mcp",
            orgId: "org_test",
            userId: "user_test",
          },
          input: "Signal from MCP",
          scopes: ["mcp:signals:write"],
        },
        { fetch: fetchMock }
      )
    ).rejects.toMatchObject({
      code: "org_access_denied",
      message: "MCP organization is not connected.",
      status: 403,
    });
  });

  it("posts MCP signal get commands to the app with service auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        classification: null,
        createdAt: "2026-06-01T00:00:00.000Z",
        entityLinks: [],
        id: "signal_123e4567-e89b-12d3-a456-426614174000",
        input: "Signal from MCP",
        status: "queued",
        updatedAt: "2026-06-01T00:01:00.000Z",
        visibilityScope: "user",
      })
    );
    const { getSignalForActorViaApp } = await importAdapter();

    await expect(
      getSignalForActorViaApp(
        {
          actor: {
            clientId: "mcp_client_test",
            grantId: "mcp_grant_test",
            kind: "mcp",
            orgId: "org_test",
            userId: "user_test",
          },
          id: "signal_123e4567-e89b-12d3-a456-426614174000",
          scopes: ["mcp:signals:read"],
        },
        { fetch: fetchMock }
      )
    ).resolves.toEqual({
      classification: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      entityLinks: [],
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      input: "Signal from MCP",
      status: "queued",
      updatedAt: "2026-06-01T00:01:00.000Z",
      visibilityScope: "user",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app-internal.lightfast.ai/api/internal/mcp/signals/get",
      expect.objectContaining({
        method: "POST",
      })
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      actor: {
        clientId: "mcp_client_test",
        grantId: "mcp_grant_test",
        kind: "mcp",
        orgId: "org_test",
        userId: "user_test",
      },
      id: "signal_123e4567-e89b-12d3-a456-426614174000",
      scopes: ["mcp:signals:read"],
    });
  });
});

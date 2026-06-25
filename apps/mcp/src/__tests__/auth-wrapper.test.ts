import { describe, expect, it, vi } from "vitest";

import { McpTokenVerificationError } from "../auth/verify-token";
import { withHostedMcpAuth } from "../server/auth-wrapper";

const resourceOrigin = "https://mcp.lightfast.localhost";

function authedRequest(token = "token") {
  return new Request("https://mcp.lightfast.localhost/mcp", {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("withHostedMcpAuth", () => {
  it("sets auth info on successful verification", async () => {
    const handler = vi.fn((request: Request) =>
      Response.json({
        clientId: (request as Request & { auth?: { clientId?: string } }).auth
          ?.clientId,
      })
    );
    const wrapped = withHostedMcpAuth(
      handler,
      async () => ({
        clientId: "mcp_client_test",
        scopes: ["mcp:system:read"],
        token: "token",
      }),
      { required: true, resourceUrl: resourceOrigin }
    );

    const response = await wrapped(authedRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      clientId: "mcp_client_test",
    });
  });

  it("returns 401 with MCP resource metadata for invalid tokens", async () => {
    const wrapped = withHostedMcpAuth(
      () => Response.json({ ok: true }),
      async () => {
        throw new McpTokenVerificationError(
          "invalid_token",
          "Bearer token is invalid."
        );
      },
      { required: true, resourceUrl: resourceOrigin }
    );

    const response = await wrapped(authedRequest());

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'resource_metadata="https://mcp.lightfast.localhost/.well-known/oauth-protected-resource"'
    );
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_token",
    });
  });

  it("returns 503 instead of 401 when grant liveness validation is unavailable", async () => {
    const wrapped = withHostedMcpAuth(
      () => Response.json({ ok: true }),
      async () => {
        throw new McpTokenVerificationError(
          "service_unavailable",
          "MCP authorization grant validation is temporarily unavailable.",
          503
        );
      },
      { required: true, resourceUrl: resourceOrigin }
    );

    const response = await wrapped(authedRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("2");
    expect(response.headers.has("www-authenticate")).toBe(false);
    await expect(response.json()).resolves.toMatchObject({
      error: "service_unavailable",
    });
  });
});

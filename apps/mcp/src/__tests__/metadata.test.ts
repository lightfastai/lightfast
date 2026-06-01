import { afterEach, describe, expect, it, vi } from "vitest";

describe("OAuth protected resource metadata", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("serves OAuth protected-resource metadata for the MCP resource", async () => {
    vi.stubEnv("MCP_AUTH_ISSUER", "https://app.lightfast.localhost");
    vi.stubEnv("MCP_RESOURCE_URL", "https://mcp.lightfast.localhost/mcp");
    vi.stubEnv("SERVICE_JWT_SECRET", "test-mcp-jwt-secret-test-mcp-jwt-secret");

    const { GET } = await import(
      "../app/.well-known/oauth-protected-resource/route"
    );

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authorization_servers: ["https://app.lightfast.localhost"],
      resource: "https://mcp.lightfast.localhost/mcp",
    });
  });
});

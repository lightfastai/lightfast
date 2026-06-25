import { afterEach, describe, expect, it } from "vitest";

import { McpOAuthError, requireHostedMcpResource } from "../mcp-oauth";

const originalMcpResourceUrl = process.env.MCP_RESOURCE_URL;

describe("MCP consent resource validation", () => {
  afterEach(() => {
    if (originalMcpResourceUrl === undefined) {
      delete process.env.MCP_RESOURCE_URL;
      return;
    }
    process.env.MCP_RESOURCE_URL = originalMcpResourceUrl;
  });

  it("accepts the configured hosted MCP resource exactly", () => {
    process.env.MCP_RESOURCE_URL = "https://mcp.lightfast.localhost/mcp";

    expect(
      requireHostedMcpResource("https://mcp.lightfast.localhost/mcp")
    ).toBe("https://mcp.lightfast.localhost/mcp");
  });

  it("rejects arbitrary resource audiences", () => {
    process.env.MCP_RESOURCE_URL = "https://mcp.lightfast.localhost/mcp";

    expect(() =>
      requireHostedMcpResource("https://attacker.example/mcp")
    ).toThrow(
      new McpOAuthError("invalid_request", "Unsupported MCP resource.")
    );
  });

  it("rejects resource indicators with fragments", () => {
    process.env.MCP_RESOURCE_URL = "https://mcp.lightfast.localhost/mcp";

    expect(() =>
      requireHostedMcpResource("https://mcp.lightfast.localhost/mcp#fragment")
    ).toThrow(
      new McpOAuthError("invalid_request", "Unsupported MCP resource.")
    );
  });

  it("fails closed when the hosted MCP resource is not configured", () => {
    delete process.env.MCP_RESOURCE_URL;

    expect(() =>
      requireHostedMcpResource("https://mcp.lightfast.localhost/mcp")
    ).toThrow("Hosted MCP resource URL is not configured.");
  });
});

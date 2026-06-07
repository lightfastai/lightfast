import { afterEach, describe, expect, it, vi } from "vitest";

const mcpState = vi.hoisted(() => {
  class MockUnauthorizedError extends Error {
    constructor(message?: string) {
      super(message);
      this.name = "UnauthorizedError";
    }
  }

  class MockStreamableHTTPError extends Error {
    constructor(
      readonly code: number | undefined,
      message?: string
    ) {
      super(message);
      this.name = "StreamableHTTPError";
    }
  }

  return {
    callTool: vi.fn(async () => ({
      content: [{ text: "done", type: "text" }],
    })),
    close: vi.fn(async () => undefined),
    connect: vi.fn(async () => undefined),
    listTools: vi.fn(async () => ({
      tools: [
        {
          description: "Search Granola meetings",
          inputSchema: {
            properties: { query: { type: "string" } },
            required: ["query"],
            type: "object",
          },
          name: "search_meetings",
        },
      ],
    })),
    transports: [] as Array<{
      options: { authProvider?: unknown } | undefined;
      url: string;
    }>,
    StreamableHTTPError: MockStreamableHTTPError,
    UnauthorizedError: MockUnauthorizedError,
  };
});

vi.mock("@vendor/mcp", () => ({
  McpClient: class {
    callTool = mcpState.callTool;
    close = mcpState.close;
    connect = mcpState.connect;
    listTools = mcpState.listTools;
  },
  StreamableHTTPClientTransport: class {
    constructor(url: URL, options?: { authProvider?: unknown }) {
      mcpState.transports.push({ options, url: url.toString() });
    }
  },
  StreamableHTTPError: mcpState.StreamableHTTPError,
  UnauthorizedError: mcpState.UnauthorizedError,
}));

import type { OAuthClientProvider } from "@vendor/mcp";

import { GranolaAppNodeError } from "../errors";
import { callGranolaMcpTool, listGranolaMcpTools } from "../mcp";

describe("Granola MCP client helpers", () => {
  const authProvider = {
    clientMetadata: {
      client_name: "Lightfast",
      redirect_uris: [
        "https://app.lightfast.ai/api/connectors/granola/oauth/callback",
      ],
      token_endpoint_auth_method: "none",
    },
    clientInformation: () => ({ client_id: "granola-client-id" }),
    codeVerifier: () => "code-verifier",
    redirectToAuthorization: vi.fn(),
    redirectUrl:
      "https://app.lightfast.ai/api/connectors/granola/oauth/callback",
    saveCodeVerifier: vi.fn(),
    saveTokens: vi.fn(),
    tokens: () => ({
      access_token: "granola-access-token",
      token_type: "Bearer",
    }),
  } satisfies OAuthClientProvider;

  afterEach(() => {
    vi.useRealTimers();
    mcpState.callTool.mockReset();
    mcpState.callTool.mockResolvedValue({
      content: [{ text: "done", type: "text" }],
    });
    mcpState.close.mockReset();
    mcpState.close.mockResolvedValue(undefined);
    mcpState.connect.mockReset();
    mcpState.connect.mockResolvedValue(undefined);
    mcpState.listTools.mockReset();
    mcpState.listTools.mockResolvedValue({
      tools: [
        {
          description: "Search Granola meetings",
          inputSchema: {
            properties: { query: { type: "string" } },
            required: ["query"],
            type: "object",
          },
          name: "search_meetings",
        },
      ],
    });
    mcpState.transports.length = 0;
  });

  it("passes the auth provider into the streamable HTTP transport and maps tools to manifests", async () => {
    await expect(
      listGranolaMcpTools({
        authProvider,
        endpoint: "https://mcp.granola.ai/mcp",
      })
    ).resolves.toEqual([
      {
        description: "Search Granola meetings",
        inputSchema: {
          properties: { query: { type: "string" } },
          required: ["query"],
          type: "object",
        },
        name: "search_meetings",
      },
    ]);

    expect(mcpState.transports).toEqual([
      {
        options: { authProvider },
        url: "https://mcp.granola.ai/mcp",
      },
    ]);
  });

  it("calls tools with arguments and tool name", async () => {
    await expect(
      callGranolaMcpTool({
        authProvider,
        endpoint: "https://mcp.granola.ai/mcp",
        input: { query: "roadmap" },
        name: "search_meetings",
      })
    ).resolves.toEqual({ content: [{ text: "done", type: "text" }] });

    expect(mcpState.callTool).toHaveBeenCalledWith({
      arguments: { query: "roadmap" },
      name: "search_meetings",
    });
    expect(mcpState.transports[0]).toEqual({
      options: { authProvider },
      url: "https://mcp.granola.ai/mcp",
    });
  });

  it("maps MCP unauthorized failures to auth required errors", async () => {
    mcpState.connect.mockRejectedValueOnce(
      new mcpState.UnauthorizedError("Authorization required")
    );

    await expect(
      listGranolaMcpTools({
        authProvider,
        endpoint: "https://mcp.granola.ai/mcp",
      })
    ).rejects.toMatchObject({
      code: "GRANOLA_MCP_AUTH_REQUIRED",
      name: "GranolaAppNodeError",
    });
  });

  it("maps streamable HTTP 401 failures to auth required errors", async () => {
    mcpState.callTool.mockRejectedValueOnce(
      new mcpState.StreamableHTTPError(
        401,
        "Server returned 401 after successful authentication"
      )
    );

    await expect(
      callGranolaMcpTool({
        authProvider,
        endpoint: "https://mcp.granola.ai/mcp",
        input: { query: "roadmap" },
        name: "search_meetings",
      })
    ).rejects.toMatchObject({
      code: "GRANOLA_MCP_AUTH_REQUIRED",
      name: "GranolaAppNodeError",
    });
  });

  it("maps malformed listing endpoints to generic MCP errors", async () => {
    await expect(
      listGranolaMcpTools({
        authProvider,
        endpoint: "not a url",
      })
    ).rejects.toMatchObject({
      code: "GRANOLA_MCP_FAILED",
      name: "GranolaAppNodeError",
    });
  });

  it("maps malformed tool call endpoints to generic MCP errors", async () => {
    await expect(
      callGranolaMcpTool({
        authProvider,
        endpoint: "not a url",
        name: "search_meetings",
      })
    ).rejects.toMatchObject({
      code: "GRANOLA_MCP_FAILED",
      name: "GranolaAppNodeError",
    });
  });

  it("maps other MCP failures to generic MCP errors", async () => {
    mcpState.listTools.mockRejectedValueOnce(new Error("Granola is down"));

    await expect(
      listGranolaMcpTools({
        authProvider,
        endpoint: "https://mcp.granola.ai/mcp",
      })
    ).rejects.toBeInstanceOf(GranolaAppNodeError);
    await expect(
      listGranolaMcpTools({
        authProvider,
        endpoint: "https://mcp.granola.ai/mcp",
      })
    ).resolves.toEqual([
      {
        description: "Search Granola meetings",
        inputSchema: {
          properties: { query: { type: "string" } },
          required: ["query"],
          type: "object",
        },
        name: "search_meetings",
      },
    ]);
  });
});

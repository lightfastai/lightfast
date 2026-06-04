import { afterEach, describe, expect, it, vi } from "vitest";

const mcpState = vi.hoisted(() => ({
  callTool: vi.fn(async () => ({
    content: [{ text: "done", type: "text" }],
  })),
  close: vi.fn(async () => undefined),
  connect: vi.fn(async () => undefined),
  listTools: vi.fn(async () => ({
    tools: [
      {
        description: "Look up an X user by username",
        inputSchema: {
          properties: { username: { type: "string" } },
          required: ["username"],
          type: "object",
        },
        name: "getUsersByUsername",
      },
    ],
  })),
  transports: [] as Array<{
    options: unknown;
    url: string;
  }>,
}));

vi.mock("@vendor/mcp", () => ({
  McpClient: class {
    callTool = mcpState.callTool;
    close = mcpState.close;
    connect = mcpState.connect;
    listTools = mcpState.listTools;
  },
  StreamableHTTPClientTransport: class {
    constructor(url: URL, options?: unknown) {
      mcpState.transports.push({ options, url: url.toString() });
    }
  },
}));

import { callXBridgeMcpTool, listXBridgeMcpTools } from "../mcp";

describe("X bridge MCP client helpers", () => {
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
          description: "Look up an X user by username",
          inputSchema: {
            properties: { username: { type: "string" } },
            required: ["username"],
            type: "object",
          },
          name: "getUsersByUsername",
        },
      ],
    });
    mcpState.transports.length = 0;
  });

  it("lists tools with a Lightfast MCP bearer token", async () => {
    await expect(
      listXBridgeMcpTools({
        endpoint: "https://app.test/api/connectors/x/mcp",
        mcpToken: "lfmcp_v1.test.payload.signature",
      })
    ).resolves.toEqual([
      {
        description: "Look up an X user by username",
        inputSchema: {
          properties: { username: { type: "string" } },
          required: ["username"],
          type: "object",
        },
        name: "getUsersByUsername",
      },
    ]);

    expect(mcpState.transports).toEqual([
      {
        options: {
          requestInit: {
            headers: {
              authorization: "Bearer lfmcp_v1.test.payload.signature",
            },
          },
        },
        url: "https://app.test/api/connectors/x/mcp",
      },
    ]);
  });

  it("allows the configured first-party MCP endpoint in production", async () => {
    await expect(
      listXBridgeMcpTools({
        allowedEndpoint: "https://lightfast.ai/api/connectors/x/mcp",
        endpoint: "https://lightfast.ai/api/connectors/x/mcp",
        mcpToken: "lfmcp_v1.test.payload.signature",
        nodeEnv: "production",
      })
    ).resolves.toEqual([
      {
        description: "Look up an X user by username",
        inputSchema: {
          properties: { username: { type: "string" } },
          required: ["username"],
          type: "object",
        },
        name: "getUsersByUsername",
      },
    ]);
  });

  it("rejects unconfigured MCP endpoints in production", async () => {
    await expect(
      listXBridgeMcpTools({
        endpoint: "https://other.example/api/connectors/x/mcp",
        mcpToken: "lfmcp_v1.test.payload.signature",
        nodeEnv: "production",
      })
    ).rejects.toMatchObject({ code: "X_CUSTOM_ENDPOINT_FORBIDDEN" });
  });

  it("calls tools with a Lightfast MCP bearer token", async () => {
    await expect(
      callXBridgeMcpTool({
        endpoint: "https://app.test/api/connectors/x/mcp",
        input: { username: "lightfast" },
        mcpToken: "lfmcp_v1.test.payload.signature",
        name: "getUsersByUsername",
      })
    ).resolves.toEqual({ content: [{ text: "done", type: "text" }] });

    expect(mcpState.callTool).toHaveBeenCalledWith({
      arguments: { username: "lightfast" },
      name: "getUsersByUsername",
    });
    expect(mcpState.transports[0]).toEqual({
      options: {
        requestInit: {
          headers: {
            authorization: "Bearer lfmcp_v1.test.payload.signature",
          },
        },
      },
      url: "https://app.test/api/connectors/x/mcp",
    });
  });

  it("calls tools against the configured first-party MCP endpoint in production", async () => {
    await expect(
      callXBridgeMcpTool({
        allowedEndpoint: "https://lightfast.ai/api/connectors/x/mcp",
        endpoint: "https://lightfast.ai/api/connectors/x/mcp",
        input: { username: "lightfast" },
        mcpToken: "lfmcp_v1.test.payload.signature",
        name: "getUsersByUsername",
        nodeEnv: "production",
      })
    ).resolves.toEqual({ content: [{ text: "done", type: "text" }] });
  });
});

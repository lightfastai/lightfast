import { describe, expect, it, vi } from "vitest";

const mcpState = vi.hoisted(() => ({
  close: vi.fn(async () => undefined),
  connect: vi.fn(async () => undefined),
  listTools: vi.fn(async () => ({
    tools: [
      {
        description: "Create a Linear issue",
        inputSchema: {
          properties: { title: { type: "string" } },
          required: ["title"],
          type: "object",
        },
        name: "create_issue",
      },
      {
        name: "list_projects",
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

import { listLinearMcpTools } from "../mcp";

describe("listLinearMcpTools", () => {
  it("maps MCP tools to a full connector tool manifest", async () => {
    await expect(
      listLinearMcpTools({
        accessToken: "lin_access",
        endpoint: "https://mcp.linear.test/mcp",
      })
    ).resolves.toEqual([
      {
        description: "Create a Linear issue",
        inputSchema: {
          properties: { title: { type: "string" } },
          required: ["title"],
          type: "object",
        },
        name: "create_issue",
      },
      {
        name: "list_projects",
      },
    ]);

    expect(mcpState.transports).toEqual([
      {
        options: {
          requestInit: {
            headers: {
              authorization: "Bearer lin_access",
            },
          },
        },
        url: "https://mcp.linear.test/mcp",
      },
    ]);
    expect(mcpState.connect).toHaveBeenCalledOnce();
    expect(mcpState.close).toHaveBeenCalledOnce();
  });
});

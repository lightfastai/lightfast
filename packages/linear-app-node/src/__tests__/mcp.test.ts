import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.useRealTimers();
    mcpState.close.mockReset();
    mcpState.close.mockResolvedValue(undefined);
    mcpState.connect.mockReset();
    mcpState.connect.mockResolvedValue(undefined);
    mcpState.listTools.mockReset();
    mcpState.listTools.mockResolvedValue({
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
    });
    mcpState.transports.length = 0;
  });

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

  it("rejects direct custom MCP endpoints outside development and test", async () => {
    await expect(
      listLinearMcpTools({
        accessToken: "lin_access",
        endpoint: "https://mcp.linear.test/mcp",
        nodeEnv: "production",
      })
    ).rejects.toMatchObject({ code: "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN" });
  });

  it("times out stalled MCP discovery and does not wait forever for close", async () => {
    vi.useFakeTimers();
    mcpState.listTools.mockImplementationOnce(
      () => new Promise(() => undefined)
    );
    mcpState.close.mockImplementationOnce(
      () => new Promise(() => undefined)
    );

    const listPromise = listLinearMcpTools({
      accessToken: "lin_access",
      endpoint: "https://mcp.linear.test/mcp",
      timeoutMs: 25,
    });
    const expectation = expect(listPromise).rejects.toMatchObject({
      cause: { name: "AbortError" },
      code: "LINEAR_MCP_FAILED",
    });

    await vi.advanceTimersByTimeAsync(25);
    await vi.advanceTimersByTimeAsync(1_000);

    await expectation;
    expect(mcpState.close).toHaveBeenCalledOnce();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

import { callXBridgeMcpTool, listXBridgeMcpTools } from "../mcp";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init,
  });
}

describe("X bridge MCP client helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    fetchMock.mockReset();
  });

  it("lists tools with a Lightfast MCP bearer token", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 1,
        jsonrpc: "2.0",
        result: {
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
        },
      })
    );

    await expect(
      listXBridgeMcpTools({
        allowedEndpoint: "https://app.test/api/connectors/x/mcp",
        endpoint: "https://app.test/api/connectors/x/mcp",
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

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.test/api/connectors/x/mcp",
      expect.objectContaining({
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "tools/list",
          params: {},
        }),
        headers: {
          accept: "application/json, text/event-stream",
          authorization: "Bearer lfmcp_v1.test.payload.signature",
          "content-type": "application/json",
        },
        method: "POST",
      })
    );
  });

  it("allows the configured first-party MCP endpoint in production", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 1,
        jsonrpc: "2.0",
        result: {
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
        },
      })
    );

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
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 1,
        jsonrpc: "2.0",
        result: { content: [{ text: "done", type: "text" }] },
      })
    );

    await expect(
      callXBridgeMcpTool({
        allowedEndpoint: "https://app.test/api/connectors/x/mcp",
        endpoint: "https://app.test/api/connectors/x/mcp",
        input: { username: "lightfast" },
        mcpToken: "lfmcp_v1.test.payload.signature",
        name: "getUsersByUsername",
        nodeEnv: "production",
      })
    ).resolves.toEqual({ content: [{ text: "done", type: "text" }] });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://app.test/api/connectors/x/mcp",
      expect.objectContaining({
        body: JSON.stringify({
          id: 1,
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            arguments: { username: "lightfast" },
            name: "getUsersByUsername",
          },
        }),
        headers: {
          accept: "application/json, text/event-stream",
          authorization: "Bearer lfmcp_v1.test.payload.signature",
          "content-type": "application/json",
        },
        method: "POST",
      })
    );
  });

  it("rejects direct custom MCP endpoints outside the allowed bridge endpoint", async () => {
    await expect(
      listXBridgeMcpTools({
        allowedEndpoint: "https://app.test/api/connectors/x/mcp",
        endpoint: "https://evil.test/mcp",
        mcpToken: "lfmcp_v1.test.payload.signature",
        nodeEnv: "production",
      })
    ).rejects.toMatchObject({ code: "X_CUSTOM_ENDPOINT_FORBIDDEN" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("wraps bridge response errors", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        error: { code: -32_000, message: "Bridge rejected request" },
        id: 1,
        jsonrpc: "2.0",
      })
    );

    await expect(
      listXBridgeMcpTools({
        allowedEndpoint: "https://app.test/api/connectors/x/mcp",
        endpoint: "https://app.test/api/connectors/x/mcp",
        mcpToken: "lfmcp_v1.test.payload.signature",
        nodeEnv: "production",
      })
    ).rejects.toMatchObject({
      cause: { name: "object" },
      code: "X_MCP_FAILED",
    });
  });

  it("calls tools against the configured first-party MCP endpoint in production", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: 1,
        jsonrpc: "2.0",
        result: { content: [{ text: "done", type: "text" }] },
      })
    );

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

  it("times out stalled bridge requests", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(
      (_url, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener(
            "abort",
            () =>
              reject(
                new DOMException("The operation was aborted.", "AbortError")
              ),
            { once: true }
          );
        })
    );

    const listPromise = listXBridgeMcpTools({
      allowedEndpoint: "https://app.test/api/connectors/x/mcp",
      endpoint: "https://app.test/api/connectors/x/mcp",
      mcpToken: "lfmcp_v1.test.payload.signature",
      nodeEnv: "production",
      timeoutMs: 25,
    });
    const expectation = expect(listPromise).rejects.toMatchObject({
      cause: { name: "AbortError" },
      code: "X_MCP_FAILED",
    });

    await vi.advanceTimersByTimeAsync(25);

    await expectation;
  });
});

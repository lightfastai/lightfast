import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  handleXConnectorMcpRequest: vi.fn(),
}));

vi.mock("../services/connectors/x-mcp-bridge", () => ({
  handleXConnectorMcpRequest: serviceMocks.handleXConnectorMcpRequest,
}));

const { handleXConnectorMcpRequest } = await import(
  "../adapters/internal/connector-mcp"
);

function mcpRequest(input: { body?: string; token?: string; url?: string }) {
  return new Request(
    input.url ?? "https://app.lightfast.localhost/api/connectors/x/mcp",
    {
      body: input.body,
      headers: {
        accept: "application/json, text/event-stream",
        ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
        "content-type": "application/json",
      },
      method: "POST",
    }
  );
}

describe("connector MCP internal adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.handleXConnectorMcpRequest.mockResolvedValue(
      new Response("ok", { status: 200 })
    );
  });

  it("parses JSON body, extracts the bearer token, and forwards explicit request context", async () => {
    const body = { id: 1, jsonrpc: "2.0", method: "tools/list" };
    const request = mcpRequest({
      body: JSON.stringify(body),
      token: "lfmcp_v1.test",
      url: "https://custom.lightfast.localhost/api/connectors/x/mcp?cursor=1",
    });

    const response = await handleXConnectorMcpRequest(request);

    expect(response.status).toBe(200);
    expect(serviceMocks.handleXConnectorMcpRequest).toHaveBeenCalledWith({
      appOrigin: "https://custom.lightfast.localhost",
      parsedBody: body,
      request,
      token: "lfmcp_v1.test",
    });
  });

  it("rejects malformed JSON before calling the service", async () => {
    const response = await handleXConnectorMcpRequest(
      mcpRequest({ body: "{bad json", token: "lfmcp_v1.test" })
    );

    await expect(response.text()).resolves.toBe("Invalid request body");
    expect(response.status).toBe(400);
    expect(serviceMocks.handleXConnectorMcpRequest).not.toHaveBeenCalled();
  });

  it("rejects missing bearer tokens before reading malformed request bodies", async () => {
    const response = await handleXConnectorMcpRequest(
      mcpRequest({ body: "{bad json" })
    );

    await expect(response.text()).resolves.toBe("Unauthorized");
    expect(response.status).toBe(401);
    expect(serviceMocks.handleXConnectorMcpRequest).not.toHaveBeenCalled();
  });

  it("rejects missing bearer tokens before calling the service", async () => {
    const response = await handleXConnectorMcpRequest(
      mcpRequest({
        body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
      })
    );

    await expect(response.text()).resolves.toBe("Unauthorized");
    expect(response.status).toBe(401);
    expect(serviceMocks.handleXConnectorMcpRequest).not.toHaveBeenCalled();
  });
});

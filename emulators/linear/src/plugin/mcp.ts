import type { AppEnv, Context, Hono, Store } from "@emulators/core";

import { LINEAR_EMULATOR_TOOLS } from "../fixtures";
import { isValidBearer } from "./auth";
import { getFailures } from "./failures";
import { renderLinearMcpPage } from "./mcp-ui";

interface McpRequestBody {
  id?: number | string | null;
  method?: string;
  params?: { name?: string; arguments?: unknown };
}

function firstHeaderValue(value: string | undefined): string | undefined {
  return value?.split(",")[0]?.trim() || undefined;
}

function protocolForHost(c: Context, host: string, requestUrl: URL): string {
  const forwardedProto = firstHeaderValue(c.req.header("x-forwarded-proto"));
  if (forwardedProto) {
    return forwardedProto;
  }
  return host.endsWith(".localhost")
    ? "https"
    : requestUrl.protocol.replace(":", "");
}

function mcpEndpointForRequest(c: Context): string {
  const requestUrl = new URL(c.req.url);
  const forwardedHost = firstHeaderValue(c.req.header("x-forwarded-host"));
  const host = forwardedHost ?? firstHeaderValue(c.req.header("host"));
  const hasPublicHost = host && (forwardedHost || host !== requestUrl.host);

  if (hasPublicHost) {
    return `${protocolForHost(c, host, requestUrl)}://${host}/mcp`;
  }

  return `${requestUrl.origin}/mcp`;
}

export function registerMcp(app: Hono<AppEnv>, store: Store): void {
  app.get(
    "/mcp",
    (c) =>
      new Response(renderLinearMcpPage(mcpEndpointForRequest(c)), {
        headers: { "content-type": "text/html; charset=utf-8" },
        status: 200,
      })
  );

  app.post("/mcp", async (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ error: "invalid_token" }, 401);
    }

    const body = (await c.req
      .json()
      .catch(() => null)) as McpRequestBody | null;
    if (!body?.method) {
      return c.json({ error: "invalid_request" }, 400);
    }

    if (body.id === undefined || body.id === null) {
      return c.body(null, 202);
    }

    if (body.method === "initialize") {
      return c.json(
        {
          id: body.id,
          jsonrpc: "2.0",
          result: {
            capabilities: { tools: {} },
            protocolVersion: "2025-06-18",
            serverInfo: { name: "linear-emulator", version: "0.1.0" },
          },
        },
        200
      );
    }

    if (body.method === "tools/list") {
      if (getFailures(store).mcpListTools) {
        return c.json(
          {
            error: { code: -32_003, message: "Linear MCP list-tools failure" },
            id: body.id,
            jsonrpc: "2.0",
          },
          500
        );
      }
      return c.json(
        {
          id: body.id,
          jsonrpc: "2.0",
          result: { tools: LINEAR_EMULATOR_TOOLS },
        },
        200
      );
    }

    if (body.method === "tools/call") {
      const name = body.params?.name;
      const tool = LINEAR_EMULATOR_TOOLS.find((item) => item.name === name);
      if (!tool) {
        return c.json(
          {
            error: { code: -32_602, message: `Unknown tool: ${name ?? ""}` },
            id: body.id,
            jsonrpc: "2.0",
          },
          200
        );
      }

      const structuredContent = {
        arguments: body.params?.arguments ?? {},
        ok: true,
        tool: tool.name,
      };
      return c.json(
        {
          id: body.id,
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(structuredContent, null, 2),
              },
            ],
            structuredContent,
          },
        },
        200
      );
    }

    return c.json(
      {
        error: { code: -32_601, message: `Unsupported method: ${body.method}` },
        id: body.id,
        jsonrpc: "2.0",
      },
      200
    );
  });
}

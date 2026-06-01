import type { AppEnv, Hono, Store } from "@emulators/core";

import { LINEAR_EMULATOR_TOOLS } from "../fixtures";
import { isValidBearer } from "./auth";
import { getFailures } from "./failures";

interface McpRequestBody {
  id?: number | string | null;
  method?: string;
  params?: { name?: string; arguments?: unknown };
}

export function registerMcp(app: Hono<AppEnv>, store: Store): void {
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

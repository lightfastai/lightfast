import type { AppEnv, Context, Hono, Store } from "@emulators/core";

import {
  GRANOLA_EMULATOR_NOTES,
  GRANOLA_EMULATOR_SCOPE,
  GRANOLA_EMULATOR_TOOLS,
  type GranolaEmulatorNote,
} from "../fixtures";
import { isValidBearer } from "./auth";
import { getFailures } from "./failures";
import { renderGranolaMcpPage } from "./mcp-ui";

interface McpRequestBody {
  id?: number | string | null;
  method?: string;
  params?: { arguments?: unknown; name?: string };
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

function originForRequest(c: Context): string {
  const requestUrl = new URL(c.req.url);
  const forwardedHost = firstHeaderValue(c.req.header("x-forwarded-host"));
  const host = forwardedHost ?? firstHeaderValue(c.req.header("host"));
  const hasPublicHost = host && (forwardedHost || host !== requestUrl.host);

  if (hasPublicHost) {
    return `${protocolForHost(c, host, requestUrl)}://${host}`;
  }

  return requestUrl.origin;
}

function mcpEndpointForRequest(c: Context): string {
  return `${originForRequest(c)}/mcp`;
}

function wwwAuthenticate(c: Context): string {
  return `Bearer resource_metadata="${originForRequest(c)}/.well-known/oauth-protected-resource", scope="${GRANOLA_EMULATOR_SCOPE}"`;
}

function jsonRpcError(input: {
  code: number;
  id: McpRequestBody["id"];
  message: string;
}) {
  return {
    error: { code: input.code, message: input.message },
    id: input.id,
    jsonrpc: "2.0",
  };
}

function noteSummary(note: GranolaEmulatorNote) {
  return {
    id: note.id,
    participants: note.participants,
    startedAt: note.startedAt,
    summary: note.summary,
    title: note.title,
  };
}

function toolArguments(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function searchNotes(query: unknown) {
  const normalizedQuery = String(query ?? "")
    .trim()
    .toLowerCase();
  if (!normalizedQuery) {
    return GRANOLA_EMULATOR_NOTES.map(noteSummary);
  }
  return GRANOLA_EMULATOR_NOTES.filter((note) =>
    [note.title, note.summary, note.body]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  ).map(noteSummary);
}

function toolCallResult(structuredContent: unknown) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(structuredContent, null, 2),
      },
    ],
    structuredContent,
  };
}

export function registerMcp(app: Hono<AppEnv>, store: Store): void {
  app.get(
    "/mcp",
    (c) =>
      new Response(renderGranolaMcpPage(mcpEndpointForRequest(c)), {
        headers: { "content-type": "text/html; charset=utf-8" },
        status: 200,
      })
  );

  app.post("/mcp", async (c) => {
    if (!isValidBearer(c, store)) {
      return c.json({ error: "invalid_token" }, 401, {
        "WWW-Authenticate": wwwAuthenticate(c),
      });
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
            serverInfo: { name: "granola-emulator", version: "0.1.0" },
          },
        },
        200
      );
    }

    if (body.method === "tools/list") {
      if (getFailures(store).mcpListTools) {
        return c.json(
          jsonRpcError({
            code: -32_003,
            id: body.id,
            message: "Granola MCP list-tools failure",
          }),
          500
        );
      }
      return c.json(
        {
          id: body.id,
          jsonrpc: "2.0",
          result: { tools: GRANOLA_EMULATOR_TOOLS },
        },
        200
      );
    }

    if (body.method === "tools/call") {
      const name = body.params?.name;
      const args = toolArguments(body.params?.arguments);

      if (name === "search_notes") {
        const structuredContent = {
          notes: searchNotes(args.query),
          query: typeof args.query === "string" ? args.query : "",
        };
        return c.json(
          {
            id: body.id,
            jsonrpc: "2.0",
            result: toolCallResult(structuredContent),
          },
          200
        );
      }

      if (name === "get_note") {
        const note = GRANOLA_EMULATOR_NOTES.find((item) => item.id === args.id);
        if (!note) {
          return c.json(
            jsonRpcError({
              code: -32_602,
              id: body.id,
              message: `Unknown note: ${String(args.id ?? "")}`,
            }),
            200
          );
        }

        return c.json(
          {
            id: body.id,
            jsonrpc: "2.0",
            result: toolCallResult({ note }),
          },
          200
        );
      }

      return c.json(
        jsonRpcError({
          code: -32_602,
          id: body.id,
          message: `Unknown tool: ${name ?? ""}`,
        }),
        200
      );
    }

    return c.json(
      jsonRpcError({
        code: -32_601,
        id: body.id,
        message: `Unsupported method: ${body.method}`,
      }),
      200
    );
  });
}

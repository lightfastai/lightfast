import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isContractProcedure } from "@orpc/contract";
import { parseError } from "@vendor/observability/error/next";

// ---------------------------------------------------------------------------
// Re-exports — MCP SDK essentials
// ---------------------------------------------------------------------------

export { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
export { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// ---------------------------------------------------------------------------
// Contract-to-MCP adapter
// ---------------------------------------------------------------------------

export interface RegisterContractToolsOptions {
  /** Prefix for all tool names (e.g. "lightfast" -> "lightfast_search"). */
  prefix?: string;
  /** Separator between key path segments. Default: "_" */
  separator?: string;
}

/**
 * Walk an oRPC contract router and register each procedure as an MCP tool.
 *
 * Tool names are derived from the router key path joined with the separator.
 * Input schemas from the contract are passed directly to `registerTool` —
 * the MCP SDK validates incoming tool calls against the same Zod schemas
 * used by the API.
 *
 * @example
 * ```ts
 * registerContractTools(server, apiContract, client, { prefix: "lightfast" });
 * // Registers: lightfast_search, lightfast_proxy_search, lightfast_proxy_execute
 * ```
 */
export function registerContractTools(
  server: McpServer,
  contract: Record<string, unknown>,
  client: Record<string, unknown>,
  options?: RegisterContractToolsOptions
): void {
  const prefix = options?.prefix;
  const sep = options?.separator ?? "_";

  function walk(
    contractNode: unknown,
    clientNode: unknown,
    keyPath: string[]
  ): void {
    if (isContractProcedure(contractNode)) {
      const def = (
        contractNode as {
          "~orpc": {
            route?: { description?: string; summary?: string };
            inputSchema?: unknown;
            outputSchema?: unknown;
          };
        }
      )["~orpc"];

      const toolName = prefix
        ? [prefix, ...keyPath].join(sep)
        : keyPath.join(sep);

      const description =
        def.route?.description ?? def.route?.summary ?? toolName;

      const fn = clientNode as (...args: unknown[]) => Promise<unknown>;

      const handle = async (...args: unknown[]) => {
        try {
          // With inputSchema: args = [parsedInput, extra]
          // Without inputSchema: args = [extra]
          const input = def.inputSchema ? args[0] : undefined;
          const result = input === undefined ? await fn() : await fn(input);
          return {
            structuredContent: result as Record<string, unknown>,
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: parseError(error),
              },
            ],
            isError: true,
          };
        }
      };

      const config: Record<string, unknown> = { description };
      if (def.inputSchema) {
        config.inputSchema = def.inputSchema;
      }
      if (def.outputSchema) {
        config.outputSchema = def.outputSchema;
      }

      server.registerTool(toolName, config as any, handle as any);
      return;
    }

    // Recurse into nested router objects
    if (contractNode && typeof contractNode === "object") {
      for (const key in contractNode as Record<string, unknown>) {
        if (Object.hasOwn(contractNode as Record<string, unknown>, key)) {
          walk(
            (contractNode as Record<string, unknown>)[key],
            (clientNode as Record<string, unknown>)[key],
            [...keyPath, key]
          );
        }
      }
    }
  }

  walk(contract, client, []);
}

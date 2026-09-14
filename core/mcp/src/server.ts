import { apiContract, lightfastMcpToolPolicy } from "@repo/api-contract";
import { McpServer } from "@vendor/mcp";
import type { LightfastClient } from "lightfast";
import { registerLightfastMcpTools } from "./tools/register";

declare const __SDK_VERSION__: string;

function getClientProcedure(
  client: LightfastClient,
  path: string
): (input?: unknown) => Promise<unknown> {
  let procedure: unknown = client;
  for (const segment of path.split(".")) {
    const node = procedure;
    if (!node || typeof node !== "object") {
      procedure = undefined;
      break;
    }
    procedure = (node as Record<string, unknown>)[segment];
  }

  if (typeof procedure !== "function") {
    throw new Error(`Missing Lightfast SDK procedure for ${path}`);
  }

  return procedure as (input?: unknown) => Promise<unknown>;
}

// Private composition shared by the stdio entrypoint and transport tests.
export function createLightfastMcpServer(client: LightfastClient): McpServer {
  const server = new McpServer({
    name: "lightfast",
    version: __SDK_VERSION__,
  });
  registerLightfastMcpTools(server, {
    contract: apiContract,
    policy: lightfastMcpToolPolicy,
    execute: ({ contractPath, input }) => {
      const procedure = getClientProcedure(client, contractPath);
      return input === undefined ? procedure() : procedure(input);
    },
  });
  return server;
}

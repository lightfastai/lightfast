import { apiContract, lightfastMcpToolPolicy } from "@repo/api-contract";
import { registerLightfastMcpTools } from "@repo/mcp-tools";
import { McpServer, StdioServerTransport } from "@vendor/mcp";
import { createLightfast } from "lightfast";

declare const __SDK_VERSION__: string;

const apiKey = process.env.LIGHTFAST_API_KEY;
if (!apiKey) {
  console.error("LIGHTFAST_API_KEY environment variable is required");
  process.exit(1);
}

const baseUrl = process.env.LIGHTFAST_API_URL;

const server = new McpServer({
  name: "lightfast",
  version: __SDK_VERSION__,
});

const client = createLightfast(apiKey, baseUrl ? { baseUrl } : {});

function getClientProcedure(path: string): (input?: unknown) => Promise<unknown> {
  const procedure = path.split(".").reduce<unknown>((node, segment) => {
    if (!node || typeof node !== "object") {
      return undefined;
    }
    return (node as Record<string, unknown>)[segment];
  }, client);

  if (typeof procedure !== "function") {
    throw new Error(`Missing Lightfast SDK procedure for ${path}`);
  }

  return procedure as (input?: unknown) => Promise<unknown>;
}

registerLightfastMcpTools(server, {
  contract: apiContract,
  policy: lightfastMcpToolPolicy,
  execute: ({ contractPath, input }) => {
    const procedure = getClientProcedure(contractPath);
    return input === undefined ? procedure() : procedure(input);
  },
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server failed to start:", error);
  process.exit(1);
});

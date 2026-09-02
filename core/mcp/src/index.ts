import { apiContract, lightfastMcpToolPolicy } from "@repo/api-contract";
import { registerLightfastMcpTools } from "@repo/mcp-tools";
import { McpServer, StdioServerTransport } from "@vendor/mcp";
import { createLightfast } from "lightfast";
import { getLightfastMcpConfig } from "./config";

declare const __SDK_VERSION__: string;

function getClientProcedure(
  client: ReturnType<typeof createLightfast>,
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

async function main() {
  const { apiKey, baseUrl } = getLightfastMcpConfig();
  const server = new McpServer({
    name: "lightfast",
    version: __SDK_VERSION__,
  });
  const client = createLightfast(apiKey, { baseUrl });

  registerLightfastMcpTools(server, {
    contract: apiContract,
    policy: lightfastMcpToolPolicy,
    execute: ({ contractPath, input }) => {
      const procedure = getClientProcedure(client, contractPath);
      return input === undefined ? procedure() : procedure(input);
    },
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});

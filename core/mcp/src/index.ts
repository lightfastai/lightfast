import { apiContract } from "@repo/app-api-contract";
import {
  McpServer,
  registerContractTools,
  StdioServerTransport,
} from "@vendor/mcp";
import { createLightfast } from "lightfast";

declare const __SDK_VERSION__: string;

const apiKey = process.env.LIGHTFAST_API_KEY;
if (!apiKey) {
  console.error("LIGHTFAST_API_KEY environment variable is required");
  process.exit(1);
}

const lf = createLightfast(
  apiKey,
  process.env.LIGHTFAST_BASE_URL
    ? { baseUrl: process.env.LIGHTFAST_BASE_URL }
    : undefined
);

const server = new McpServer({
  name: "lightfast",
  version: __SDK_VERSION__,
});

registerContractTools(server, apiContract, lf, { prefix: "lightfast" });

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server failed to start:", error);
  process.exit(1);
});

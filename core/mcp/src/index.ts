import { McpServer, StdioServerTransport } from "@vendor/mcp";

declare const __SDK_VERSION__: string;

const apiKey = process.env.LIGHTFAST_API_KEY;
if (!apiKey) {
  console.error("LIGHTFAST_API_KEY environment variable is required");
  process.exit(1);
}

const server = new McpServer({
  name: "lightfast",
  version: __SDK_VERSION__,
});

// Tools removed — pending post-v2 contract definition.

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("MCP server failed to start:", error);
  process.exit(1);
});

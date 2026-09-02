import { StdioServerTransport } from "@vendor/mcp";

import { createLocalMcpServer } from "./server";

const server = createLocalMcpServer();
const transport = new StdioServerTransport();

server.connect(transport).catch((error: unknown) => {
  process.stderr.write(
    `Local MCP server failed: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});

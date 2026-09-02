import { ListToolsRequestSchema, McpServer } from "@vendor/mcp";

export function createLocalMcpServer(): McpServer {
  const server = new McpServer({
    name: "lightfast-local",
    version: "0.0.0",
  });

  server.server.registerCapabilities({ tools: {} });
  server.server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [],
  }));

  return server;
}

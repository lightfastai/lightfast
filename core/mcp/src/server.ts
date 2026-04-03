import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Lightfast, SearchRequestSchema } from "lightfast";

declare const __SDK_VERSION__: string;

interface ServerConfig {
  apiKey: string;
  baseUrl?: string;
}

export async function createServer(config: ServerConfig): Promise<void> {
  const lightfast = new Lightfast({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
  });

  const server = new McpServer({
    name: "lightfast-mcp",
    version: __SDK_VERSION__,
  });

  // Register search tool
  server.tool(
    "lightfast_search",
    "Search through org decisions and observations across connected tools. Returns semantically relevant results with scores, snippets, and metadata.",
    SearchRequestSchema.shape,
    async (args) => {
      const results = await lightfast.search(args);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is reserved for MCP protocol)
  console.error("Lightfast MCP server started");
}

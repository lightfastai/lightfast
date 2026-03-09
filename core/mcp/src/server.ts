import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  Lightfast,
  V1ContentsRequestSchema,
  V1FindSimilarRequestSchema,
  V1GraphRequestSchema,
  V1RelatedRequestSchema,
  V1SearchRequestSchema,
} from "lightfast";

declare const __SDK_VERSION__: string;

export interface ServerConfig {
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
    "Search through workspace decisions and observations across connected tools. Returns semantically relevant results with scores, snippets, and metadata.",
    V1SearchRequestSchema.shape,
    async (args) => {
      const results = await lightfast.search(args);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // Register contents tool
  server.tool(
    "lightfast_contents",
    "Fetch full content for documents and observations by their IDs. Returns complete content including metadata.",
    V1ContentsRequestSchema.shape,
    async (args) => {
      const results = await lightfast.contents(args);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // Register find similar tool
  server.tool(
    "lightfast_find_similar",
    "Find content semantically similar to a given document or URL. Either 'id' or 'url' must be provided. Returns similar items with similarity scores.",
    V1FindSimilarRequestSchema.shape,
    async (args) => {
      const results = await lightfast.findSimilar(args);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // Register graph tool
  server.tool(
    "lightfast_graph",
    "Traverse the relationship graph from a starting observation. Returns connected observations with relationship edges. Supports depth control (1-3) and relationship type filtering.",
    V1GraphRequestSchema.shape,
    async (args) => {
      const results = await lightfast.graph(args);
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
  );

  // Register related tool
  server.tool(
    "lightfast_related",
    "Find observations directly connected to a given observation via relationships. Returns related events grouped by source system with relationship types and directions.",
    V1RelatedRequestSchema.shape,
    async (args) => {
      const results = await lightfast.related(args);
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

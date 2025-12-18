import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Lightfast } from "lightfast";
import {
  V1SearchRequestSchema,
  V1ContentsRequestSchema,
  V1FindSimilarRequestSchema,
} from "@repo/console-types/api";

declare const __SDK_VERSION__: string;

export interface ServerConfig {
  apiKey: string;
  baseUrl?: string;
}

// Extract the base object schema shape from FindSimilar (before .refine())
// This is needed because .refine() wraps the schema in ZodEffects
const V1FindSimilarBaseSchema = V1FindSimilarRequestSchema._def.schema;

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
    "Search through workspace neural memory for relevant documents and observations. Returns semantically relevant results with scores, snippets, and metadata.",
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
  // Note: V1FindSimilarRequestSchema has .refine() for "id or url required" validation
  // The .refine() validation happens at runtime in the Lightfast SDK
  // We use the base schema shape (before .refine()) for the MCP tool schema
  server.tool(
    "lightfast_find_similar",
    "Find content semantically similar to a given document or URL. Either 'id' or 'url' must be provided. Returns similar items with similarity scores.",
    V1FindSimilarBaseSchema.shape,
    async (args) => {
      // Validate with the full schema including refinement
      const validated = V1FindSimilarRequestSchema.parse(args);
      const results = await lightfast.findSimilar(validated);
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

import {
  type FullConnectorToolManifest,
  fullConnectorToolManifestSchema,
} from "@repo/connector-contract";
import {
  McpClient,
  StreamableHTTPClientTransport,
  type Tool,
} from "@vendor/mcp";

import { LinearAppNodeError } from "./errors";

export async function listLinearMcpTools(input: {
  accessToken: string;
  endpoint: string;
}): Promise<FullConnectorToolManifest> {
  const client = new McpClient({
    name: "lightfast-linear-app-node",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(input.endpoint), {
    requestInit: {
      headers: {
        authorization: `Bearer ${input.accessToken}`,
      },
    },
  });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    return fullConnectorToolManifestSchema.parse(tools.map(toManifestItem));
  } catch (error) {
    if (error instanceof LinearAppNodeError) {
      throw error;
    }
    throw new LinearAppNodeError(
      "LINEAR_MCP_FAILED",
      "Linear MCP tool listing failed.",
      error
    );
  } finally {
    await client.close().catch(() => undefined);
  }
}

function toManifestItem(tool: Tool) {
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    name: tool.name,
  };
}

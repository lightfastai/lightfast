import {
  type FullConnectorToolManifest,
  fullConnectorToolManifestSchema,
} from "@repo/connector-contract";
import {
  McpClient,
  StreamableHTTPClientTransport,
  type Tool,
} from "@vendor/mcp";

import { assertXEndpointAllowed, DEFAULT_X_ENDPOINTS } from "./config";
import { XAppNodeError } from "./errors";

const DEFAULT_X_MCP_TIMEOUT_MS = 10_000;
const DEFAULT_X_MCP_CLOSE_TIMEOUT_MS = 1000;

export async function listXBridgeMcpTools(input: {
  endpoint: string;
  mcpToken: string;
  nodeEnv?: string;
  timeoutMs?: number;
}): Promise<FullConnectorToolManifest> {
  assertXEndpointAllowed({
    defaultValue: DEFAULT_X_ENDPOINTS.mcpEndpoint,
    nodeEnv: input.nodeEnv,
    value: input.endpoint,
  });

  const client = new McpClient({
    name: "lightfast-x-app-node",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(input.endpoint), {
    requestInit: {
      headers: {
        authorization: `Bearer ${input.mcpToken}`,
      },
    },
  });
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    input.timeoutMs ?? DEFAULT_X_MCP_TIMEOUT_MS
  );

  try {
    await withAbort(client.connect(transport), abortController.signal);
    const { tools } = await withAbort(
      client.listTools(),
      abortController.signal
    );
    return fullConnectorToolManifestSchema.parse(tools.map(toManifestItem));
  } catch (error) {
    if (error instanceof XAppNodeError) {
      throw error;
    }
    throw new XAppNodeError(
      "X_MCP_FAILED",
      "X MCP tool listing failed.",
      error
    );
  } finally {
    clearTimeout(timeout);
    await closeMcpClient(client).catch(() => undefined);
  }
}

export async function callXBridgeMcpTool(input: {
  endpoint: string;
  input?: Record<string, unknown>;
  mcpToken: string;
  name: string;
  nodeEnv?: string;
  timeoutMs?: number;
}): Promise<unknown> {
  assertXEndpointAllowed({
    defaultValue: DEFAULT_X_ENDPOINTS.mcpEndpoint,
    nodeEnv: input.nodeEnv,
    value: input.endpoint,
  });

  const client = new McpClient({
    name: "lightfast-x-app-node",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(input.endpoint), {
    requestInit: {
      headers: {
        authorization: `Bearer ${input.mcpToken}`,
      },
    },
  });
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    input.timeoutMs ?? DEFAULT_X_MCP_TIMEOUT_MS
  );

  try {
    await withAbort(client.connect(transport), abortController.signal);
    return await withAbort(
      client.callTool({
        arguments: input.input,
        name: input.name,
      }),
      abortController.signal
    );
  } catch (error) {
    if (error instanceof XAppNodeError) {
      throw error;
    }
    throw new XAppNodeError("X_MCP_FAILED", "X MCP tool call failed.", error);
  } finally {
    clearTimeout(timeout);
    await closeMcpClient(client).catch(() => undefined);
  }
}

async function closeMcpClient(client: { close(): Promise<void> }) {
  await Promise.race([client.close(), delay(DEFAULT_X_MCP_CLOSE_TIMEOUT_MS)]);
}

async function withAbort<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  if (signal.aborted) {
    throw abortError();
  }

  return await Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(abortError()), {
        once: true,
      });
    }),
  ]);
}

function delay(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function toManifestItem(tool: Tool) {
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    name: tool.name,
  };
}

import {
  type FullConnectorToolManifest,
  fullConnectorToolManifestSchema,
} from "@repo/connector-contract";
import { Client, StreamableHTTPClientTransport, type Tool } from "@vendor/mcp";

import {
  assertLinearEndpointAllowed,
  DEFAULT_LINEAR_ENDPOINTS,
} from "./config";
import { LinearAppNodeError } from "./errors";

const DEFAULT_LINEAR_MCP_TIMEOUT_MS = 10_000;
const DEFAULT_LINEAR_MCP_CLOSE_TIMEOUT_MS = 1000;

export async function listLinearMcpTools(input: {
  accessToken: string;
  endpoint: string;
  nodeEnv?: string;
  timeoutMs?: number;
}): Promise<FullConnectorToolManifest> {
  assertLinearEndpointAllowed({
    defaultValue: DEFAULT_LINEAR_ENDPOINTS.mcpEndpoint,
    nodeEnv: input.nodeEnv,
    value: input.endpoint,
  });

  const client = new Client({
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
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    input.timeoutMs ?? DEFAULT_LINEAR_MCP_TIMEOUT_MS
  );

  try {
    await withAbort(client.connect(transport), abortController.signal);
    const { tools } = await withAbort(
      client.listTools(),
      abortController.signal
    );
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
    clearTimeout(timeout);
    await closeMcpClient(client).catch(() => undefined);
  }
}

export async function callLinearMcpTool(input: {
  accessToken: string;
  endpoint: string;
  input?: Record<string, unknown>;
  name: string;
  nodeEnv?: string;
  timeoutMs?: number;
}): Promise<unknown> {
  assertLinearEndpointAllowed({
    defaultValue: DEFAULT_LINEAR_ENDPOINTS.mcpEndpoint,
    nodeEnv: input.nodeEnv,
    value: input.endpoint,
  });

  const client = new Client({
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
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    input.timeoutMs ?? DEFAULT_LINEAR_MCP_TIMEOUT_MS
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
    if (error instanceof LinearAppNodeError) {
      throw error;
    }
    throw new LinearAppNodeError(
      "LINEAR_MCP_FAILED",
      "Linear MCP tool call failed.",
      error
    );
  } finally {
    clearTimeout(timeout);
    await closeMcpClient(client).catch(() => undefined);
  }
}

async function closeMcpClient(client: { close(): Promise<void> }) {
  await Promise.race([
    client.close(),
    delay(DEFAULT_LINEAR_MCP_CLOSE_TIMEOUT_MS),
  ]);
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

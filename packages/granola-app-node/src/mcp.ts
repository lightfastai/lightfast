import {
  type FullConnectorToolManifest,
  fullConnectorToolManifestSchema,
} from "@repo/connector-contract";
import {
  McpClient,
  type OAuthClientProvider,
  StreamableHTTPClientTransport,
  type Tool,
  UnauthorizedError,
} from "@vendor/mcp";

import { GranolaAppNodeError } from "./errors";

const DEFAULT_GRANOLA_MCP_TIMEOUT_MS = 10_000;
const DEFAULT_GRANOLA_MCP_CLOSE_TIMEOUT_MS = 1000;

export async function listGranolaMcpTools(input: {
  authProvider: OAuthClientProvider;
  endpoint: string;
  timeoutMs?: number;
}): Promise<FullConnectorToolManifest> {
  const client = new McpClient({
    name: "lightfast-granola-app-node",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(input.endpoint), {
    authProvider: input.authProvider,
  });
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    input.timeoutMs ?? DEFAULT_GRANOLA_MCP_TIMEOUT_MS
  );

  try {
    await withAbort(client.connect(transport), abortController.signal);
    const { tools } = await withAbort(
      client.listTools(),
      abortController.signal
    );
    return fullConnectorToolManifestSchema.parse(tools.map(toManifestItem));
  } catch (error) {
    throw mapGranolaMcpError(
      error,
      "Granola MCP authorization required.",
      "Granola MCP tool listing failed."
    );
  } finally {
    clearTimeout(timeout);
    await closeMcpClient(client).catch(() => undefined);
  }
}

export async function callGranolaMcpTool(input: {
  authProvider: OAuthClientProvider;
  endpoint: string;
  input?: Record<string, unknown>;
  name: string;
  timeoutMs?: number;
}): Promise<unknown> {
  const client = new McpClient({
    name: "lightfast-granola-app-node",
    version: "0.1.0",
  });
  const transport = new StreamableHTTPClientTransport(new URL(input.endpoint), {
    authProvider: input.authProvider,
  });
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    input.timeoutMs ?? DEFAULT_GRANOLA_MCP_TIMEOUT_MS
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
    throw mapGranolaMcpError(
      error,
      "Granola MCP authorization required.",
      "Granola MCP tool call failed."
    );
  } finally {
    clearTimeout(timeout);
    await closeMcpClient(client).catch(() => undefined);
  }
}

async function closeMcpClient(client: { close(): Promise<void> }) {
  await Promise.race([
    client.close(),
    delay(DEFAULT_GRANOLA_MCP_CLOSE_TIMEOUT_MS),
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

function mapGranolaMcpError(
  error: unknown,
  authMessage: string,
  fallbackMessage: string
): GranolaAppNodeError {
  if (error instanceof GranolaAppNodeError) {
    return error;
  }
  if (isUnauthorizedError(error)) {
    return new GranolaAppNodeError(
      "GRANOLA_MCP_AUTH_REQUIRED",
      authMessage,
      error
    );
  }
  return new GranolaAppNodeError("GRANOLA_MCP_FAILED", fallbackMessage, error);
}

function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof UnauthorizedError ||
    (error instanceof Error && error.name === "UnauthorizedError")
  );
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

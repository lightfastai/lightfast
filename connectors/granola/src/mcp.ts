import {
  type FullConnectorToolManifest,
  fullConnectorToolManifestSchema,
} from "@lightfast/connector-core";
import {
  McpClient,
  type OAuthClientProvider,
  StreamableHTTPClientTransport,
  StreamableHTTPError,
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
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    input.timeoutMs ?? DEFAULT_GRANOLA_MCP_TIMEOUT_MS
  );
  let client: InstanceType<typeof McpClient> | undefined;

  try {
    client = new McpClient({
      name: "lightfast-connector-granola",
      version: "0.1.0",
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(input.endpoint),
      {
        authProvider: input.authProvider,
      }
    );
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
    if (client) {
      await closeMcpClient(client).catch(() => undefined);
    }
  }
}

export async function callGranolaMcpTool(input: {
  authProvider: OAuthClientProvider;
  endpoint: string;
  input?: Record<string, unknown>;
  name: string;
  timeoutMs?: number;
}): Promise<unknown> {
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    input.timeoutMs ?? DEFAULT_GRANOLA_MCP_TIMEOUT_MS
  );
  let client: InstanceType<typeof McpClient> | undefined;

  try {
    client = new McpClient({
      name: "lightfast-connector-granola",
      version: "0.1.0",
    });
    const transport = new StreamableHTTPClientTransport(
      new URL(input.endpoint),
      {
        authProvider: input.authProvider,
      }
    );
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
    if (client) {
      await closeMcpClient(client).catch(() => undefined);
    }
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
    (error instanceof StreamableHTTPError && error.code === 401) ||
    isStreamableHttp401Error(error) ||
    (error instanceof Error && error.name === "UnauthorizedError")
  );
}

function isStreamableHttp401Error(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "StreamableHTTPError" &&
    "code" in error &&
    error.code === 401
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

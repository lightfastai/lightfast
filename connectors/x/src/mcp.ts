import {
  type FullConnectorToolManifest,
  fullConnectorToolManifestSchema,
} from "@lightfast/connector-core";
import { z } from "zod";

import { assertXEndpointAllowed, DEFAULT_X_ENDPOINTS } from "./config";
import { XAppNodeError } from "./errors";

const DEFAULT_X_MCP_TIMEOUT_MS = 10_000;
const STREAMABLE_HTTP_ACCEPT_HEADER = "application/json, text/event-stream";

const jsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
});

const toolsListResponseSchema = z.object({
  error: jsonRpcErrorSchema.optional(),
  result: z
    .object({
      tools: fullConnectorToolManifestSchema,
    })
    .optional(),
});

const toolCallResponseSchema = z.object({
  error: jsonRpcErrorSchema.optional(),
  result: z.unknown().optional(),
});

export async function listXBridgeMcpTools(input: {
  allowedEndpoint?: string;
  endpoint: string;
  mcpToken: string;
  nodeEnv?: string;
  timeoutMs?: number;
}): Promise<FullConnectorToolManifest> {
  assertXEndpointAllowed({
    defaultValue: input.allowedEndpoint ?? DEFAULT_X_ENDPOINTS.mcpEndpoint,
    nodeEnv: input.nodeEnv,
    value: input.endpoint,
  });

  const response = await sendXBridgeMcpRequest({
    endpoint: input.endpoint,
    mcpToken: input.mcpToken,
    payload: {
      id: 1,
      jsonrpc: "2.0",
      method: "tools/list",
      params: {},
    },
    timeoutMs: input.timeoutMs,
  }).catch((error) => {
    throw new XAppNodeError(
      "X_MCP_FAILED",
      "X MCP tool listing failed.",
      error
    );
  });

  const parsed = toolsListResponseSchema.parse(response);
  if (parsed.error) {
    throw new XAppNodeError(
      "X_MCP_FAILED",
      "X MCP tool listing failed.",
      parsed.error
    );
  }
  if (!parsed.result) {
    throw new XAppNodeError("X_MCP_FAILED", "X MCP tool listing failed.");
  }

  return parsed.result.tools;
}

export async function callXBridgeMcpTool(input: {
  allowedEndpoint?: string;
  endpoint: string;
  input?: Record<string, unknown>;
  mcpToken: string;
  name: string;
  nodeEnv?: string;
  timeoutMs?: number;
}): Promise<unknown> {
  assertXEndpointAllowed({
    defaultValue: input.allowedEndpoint ?? DEFAULT_X_ENDPOINTS.mcpEndpoint,
    nodeEnv: input.nodeEnv,
    value: input.endpoint,
  });

  const response = await sendXBridgeMcpRequest({
    endpoint: input.endpoint,
    mcpToken: input.mcpToken,
    payload: {
      id: 1,
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        arguments: input.input,
        name: input.name,
      },
    },
    timeoutMs: input.timeoutMs,
  }).catch((error) => {
    throw new XAppNodeError("X_MCP_FAILED", "X MCP tool call failed.", error);
  });

  const parsed = toolCallResponseSchema.parse(response);
  if (parsed.error) {
    throw new XAppNodeError(
      "X_MCP_FAILED",
      "X MCP tool call failed.",
      parsed.error
    );
  }

  return parsed.result;
}

async function sendXBridgeMcpRequest(input: {
  endpoint: string;
  mcpToken: string;
  payload: unknown;
  timeoutMs?: number;
}) {
  const abortController = new AbortController();
  const timeout = setTimeout(
    () => abortController.abort(),
    input.timeoutMs ?? DEFAULT_X_MCP_TIMEOUT_MS
  );

  try {
    const response = await fetch(input.endpoint, {
      body: JSON.stringify(input.payload),
      headers: {
        accept: STREAMABLE_HTTP_ACCEPT_HEADER,
        authorization: `Bearer ${input.mcpToken}`,
        "content-type": "application/json",
      },
      method: "POST",
      signal: abortController.signal,
    });
    if (!response.ok) {
      throw new Error(`X MCP request failed with status ${response.status}.`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

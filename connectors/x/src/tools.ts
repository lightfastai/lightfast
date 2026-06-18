import { z } from "zod";

import { XAppNodeError } from "./errors";
import {
  buildXOperationRequest,
  getXOperationDefinition,
  getXOperationDefinitions,
  operationToolDefinition,
} from "./operations";

export interface XToolDefinition {
  description: string;
  inputSchema: Record<string, unknown>;
  name: string;
}

export interface ExecuteXApiToolInput {
  accessToken: string;
  apiOrigin: string;
  connectedActorId?: string | null;
  fetch?: typeof fetch;
  input?: Record<string, unknown>;
  name: string;
  signal?: AbortSignal;
}

export interface XApiToolResult {
  content: Array<{ text: string; type: "text" }>;
  structuredContent: unknown;
}

const objectSchema = z.record(z.string(), z.unknown()).optional();

export const X_TOOL_DEFINITIONS = getXOperationDefinitions().map(
  operationToolDefinition
) satisfies XToolDefinition[];

export async function executeXApiTool(
  input: ExecuteXApiToolInput
): Promise<XApiToolResult> {
  const requestFetch = input.fetch ?? fetch;
  const args = objectSchema.parse(input.input) ?? {};
  const operation = getXOperationDefinition(input.name);
  if (!operation) {
    throw new XAppNodeError("X_TOOL_CALL_FAILED", "Unsupported X tool name.");
  }

  let request: ReturnType<typeof buildXOperationRequest>;
  try {
    request = buildXOperationRequest({
      apiOrigin: input.apiOrigin,
      connectedActorId: input.connectedActorId,
      operation,
      toolInput: args,
    });
  } catch (error) {
    if (error instanceof XAppNodeError) {
      throw error;
    }
    throw new XAppNodeError(
      "X_TOOL_CALL_FAILED",
      "X API tool call failed.",
      error
    );
  }

  try {
    const response = await requestFetch(request.url, {
      body: request.body,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.accessToken}`,
        ...request.headers,
      },
      method: request.method,
      signal: input.signal,
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || json === null) {
      throw new XAppNodeError("X_TOOL_CALL_FAILED", "X API tool call failed.");
    }

    return {
      content: [
        {
          text: `X tool ${input.name} completed.`,
          type: "text",
        },
      ],
      structuredContent: json,
    };
  } catch (error) {
    if (error instanceof XAppNodeError) {
      throw error;
    }
    throw new XAppNodeError(
      "X_TOOL_CALL_FAILED",
      "X API tool call failed.",
      error
    );
  }
}

export function getXToolDefinitions(): XToolDefinition[] {
  return [...X_TOOL_DEFINITIONS];
}

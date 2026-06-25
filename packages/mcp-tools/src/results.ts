import { parseError } from "@vendor/observability/error/next";

interface LightfastMcpContent {
  text: string;
  type: "text";
}

export interface LightfastMcpSuccessResult {
  content: LightfastMcpContent[];
  structuredContent: Record<string, unknown>;
}

export interface LightfastMcpErrorResult {
  content: LightfastMcpContent[];
  isError: true;
}

function toStructuredContent(result: unknown): Record<string, unknown> {
  const jsonResult = toJsonCompatible(result);
  if (
    jsonResult &&
    typeof jsonResult === "object" &&
    !Array.isArray(jsonResult)
  ) {
    return jsonResult as Record<string, unknown>;
  }
  return { result: jsonResult ?? null };
}

function stringifyResult(result: unknown): string {
  const json = safeStringify(result, 2);
  return json ?? safeToString(result);
}

function toJsonCompatible(result: unknown): unknown {
  const json = safeStringify(result);
  if (json === undefined) {
    return;
  }
  return JSON.parse(json) as unknown;
}

function safeStringify(result: unknown, space?: number): string | undefined {
  try {
    return JSON.stringify(result, null, space);
  } catch {
    return;
  }
}

function safeToString(result: unknown): string {
  try {
    return String(result);
  } catch {
    return "[Unserializable MCP result]";
  }
}

export function formatMcpSuccess(result: unknown): LightfastMcpSuccessResult {
  return {
    content: [{ text: stringifyResult(result), type: "text" }],
    structuredContent: toStructuredContent(result),
  };
}

export function formatMcpError(error: unknown): LightfastMcpErrorResult {
  return {
    content: [{ text: parseError(error), type: "text" }],
    isError: true,
  };
}

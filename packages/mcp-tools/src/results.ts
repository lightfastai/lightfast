import { parseError } from "@vendor/observability/error/next";

export interface LightfastMcpContent {
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
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return { result };
}

function stringifyResult(result: unknown): string {
  const json = JSON.stringify(result, null, 2);
  return json ?? String(result);
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

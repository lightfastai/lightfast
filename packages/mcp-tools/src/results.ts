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
  const json = JSON.stringify(result, null, 2);
  return json ?? String(result);
}

function toJsonCompatible(result: unknown): unknown {
  const json = JSON.stringify(result);
  if (json === undefined) {
    return;
  }
  return JSON.parse(json) as unknown;
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

import { nanoid } from "@repo/lib";

export interface RequestContext {
  requestId: string;
}

export const REQUEST_ID_HEADER = "X-Lightfast-Request-Id";

const generateRequestId = () => nanoid(21);
const isValidRequestId = (requestId: string): boolean =>
  typeof requestId === "string" && requestId.length === 21;

// Create a request context
export function createRequestContext(): RequestContext {
  return {
    requestId: generateRequestId(),
  };
}

// Extract request context from headers
export function extractRequestContext(headers: Headers): RequestContext | null {
  const requestId = headers.get(REQUEST_ID_HEADER);

  if (!requestId || !isValidRequestId(requestId)) {
    return null;
  }

  return {
    requestId,
  };
}

// Add request context to headers
export function addRequestContext(
  headers: Headers,
  context: RequestContext,
): Headers {
  if (!isValidRequestId(context.requestId)) {
    throw new Error("Invalid request ID format");
  }

  headers.set(REQUEST_ID_HEADER, context.requestId);
  return headers;
}

// Type-safe utility to create response headers with request ID
export function withRequestId(
  requestId: string,
  additionalHeaders: Record<string, string> = {},
): Record<string, string> {
  return {
    ...additionalHeaders,
    [REQUEST_ID_HEADER]: requestId,
  };
}

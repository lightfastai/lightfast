export type XAppNodeErrorCode =
  | "X_CUSTOM_ENDPOINT_FORBIDDEN"
  | "X_METADATA_FAILED"
  | "X_MCP_FAILED"
  | "X_OAUTH_EXCHANGE_FAILED"
  | "X_REVOKE_FAILED"
  | "X_TOKEN_REFRESH_FAILED"
  | "X_TOOL_CALL_FAILED";

export interface XAppNodeErrorCause {
  name: string;
}

export class XAppNodeError extends Error {
  readonly cause?: XAppNodeErrorCause;

  constructor(
    readonly code: XAppNodeErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message);
    this.name = "XAppNodeError";
    this.cause = sanitizeCause(cause);
  }
}

function sanitizeCause(cause: unknown): XAppNodeErrorCause | undefined {
  if (cause === undefined || cause === null) {
    return;
  }
  if (cause instanceof Error) {
    return { name: cause.name || "Error" };
  }
  return { name: typeof cause };
}

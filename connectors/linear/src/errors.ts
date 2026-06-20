export type LinearAppNodeErrorCode =
  | "LINEAR_CONFIG_INCOMPLETE"
  | "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN"
  | "LINEAR_OAUTH_EXCHANGE_FAILED"
  | "LINEAR_TOKEN_REFRESH_FAILED"
  | "LINEAR_REVOKE_FAILED"
  | "LINEAR_METADATA_FAILED"
  | "LINEAR_MCP_FAILED";

interface LinearAppNodeErrorCause {
  name: string;
}

export class LinearAppNodeError extends Error {
  readonly cause?: LinearAppNodeErrorCause;

  constructor(
    readonly code: LinearAppNodeErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message);
    this.name = "LinearAppNodeError";
    this.cause = sanitizeCause(cause);
  }
}

function sanitizeCause(cause: unknown): LinearAppNodeErrorCause | undefined {
  if (cause === undefined || cause === null) {
    return;
  }
  if (cause instanceof Error) {
    return { name: cause.name || "Error" };
  }
  return { name: typeof cause };
}

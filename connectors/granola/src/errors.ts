export type GranolaAppNodeErrorCode =
  | "GRANOLA_MCP_AUTH_REQUIRED"
  | "GRANOLA_MCP_FAILED"
  | "GRANOLA_TOKEN_REFRESH_FAILED";

interface GranolaAppNodeErrorCause {
  name: string;
}

export class GranolaAppNodeError extends Error {
  readonly cause?: GranolaAppNodeErrorCause;

  constructor(
    readonly code: GranolaAppNodeErrorCode,
    message: string,
    cause?: unknown
  ) {
    super(message);
    this.name = "GranolaAppNodeError";
    this.cause = sanitizeCause(cause);
  }
}

function sanitizeCause(cause: unknown): GranolaAppNodeErrorCause | undefined {
  if (cause === undefined || cause === null) {
    return;
  }
  if (cause instanceof Error) {
    return { name: cause.name || "Error" };
  }
  return { name: typeof cause };
}

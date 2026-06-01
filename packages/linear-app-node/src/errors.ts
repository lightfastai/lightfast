export class LinearAppNodeError extends Error {
  constructor(
    readonly code:
      | "LINEAR_CONFIG_INCOMPLETE"
      | "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN"
      | "LINEAR_OAUTH_EXCHANGE_FAILED"
      | "LINEAR_TOKEN_REFRESH_FAILED"
      | "LINEAR_REVOKE_FAILED"
      | "LINEAR_METADATA_FAILED"
      | "LINEAR_MCP_FAILED",
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "LinearAppNodeError";
  }
}

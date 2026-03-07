export interface ServiceClientConfig {
  /** The shared GATEWAY_API_KEY secret. */
  apiKey: string;
  /** Optional correlation ID for request tracing. */
  correlationId?: string;
  /** Optional request source identifier (e.g., "backfill", "console-trpc"). */
  requestSource?: string;
}

/**
 * Build standard inter-service auth headers.
 * All internal service calls use X-API-Key for authentication.
 */
export function buildServiceHeaders(config: ServiceClientConfig): Record<string, string> {
  return {
    "X-API-Key": config.apiKey,
    ...(config.requestSource ? { "X-Request-Source": config.requestSource } : {}),
    ...(config.correlationId ? { "X-Correlation-Id": config.correlationId } : {}),
  };
}

export interface ServiceClientConfig {
  /** The shared GATEWAY_API_KEY secret. */
  apiKey: string;
  /** Optional correlation ID for request tracing. */
  correlationId?: string;
  /** Optional request source identifier (e.g., "backfill", "console-trpc"). */
  requestSource?: string;
}

/**
 * Sanitize a correlation ID for safe use in HTTP headers and logs.
 * Strips non-printable and non-ASCII characters, limits length.
 */
function sanitizeCorrelationId(id: string): string {
  return id.replace(/[^\x20-\x7E]/g, "").slice(0, 128);
}

/**
 * Build standard inter-service auth headers.
 * All internal service calls use X-API-Key for authentication.
 */
export function buildServiceHeaders(
  config: ServiceClientConfig
): Record<string, string> {
  return {
    "X-API-Key": config.apiKey,
    ...(config.requestSource
      ? { "X-Request-Source": config.requestSource }
      : {}),
    ...(config.correlationId
      ? { "X-Correlation-Id": sanitizeCorrelationId(config.correlationId) }
      : {}),
  };
}

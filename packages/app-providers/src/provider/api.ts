import { z } from "zod";

// ── Connection Health ────────────────────────────────────────────────────────

export const connectionStatusSchema = z.enum([
  "healthy",
  "revoked",
  "suspended",
]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

/**
 * Universal connection health probe — lives on BaseProviderFields (optional).
 * Called by a cron job to detect 401/revoked/suspended connections.
 * Returns "healthy" when the connection is working, or the failure reason.
 *
 * Providers without a meaningful liveness endpoint (e.g., Apollo API keys that
 * don't expire) omit this field — the polling cron skips them.
 */
export interface HealthCheckDef<TConfig> {
  readonly check: (
    config: TConfig,
    externalId: string,
    accessToken: string | null
  ) => Promise<ConnectionStatus>;
}

/** Runtime values not sourced from env (e.g. callbackBaseUrl) */
export const runtimeConfigSchema = z.object({
  callbackBaseUrl: z.string(),
});
export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

// ── API Surface schemas ─────────────────────────────────────────────────────────

export const rateLimitSchema = z.object({
  remaining: z.number(),
  resetAt: z.date(),
  limit: z.number(),
});

export type RateLimit = z.infer<typeof rateLimitSchema>;

// ── Proxy Wire Types ──────────────────────────────────────────────────────────
// Colocated here because ResourcePickerExecuteApiFn (below) uses ProxyExecuteResponse
// as its return type — the call-site types are provider-level concerns.

export const proxyExecuteRequestSchema = z.object({
  endpointId: z.string(),
  pathParams: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.string()).optional(),
  body: z.unknown().optional(),
});
export type ProxyExecuteRequest = z.infer<typeof proxyExecuteRequestSchema>;

export const proxyExecuteResponseSchema = z.object({
  status: z.number(),
  data: z.unknown(),
  headers: z.record(z.string(), z.string()),
});
export type ProxyExecuteResponse = z.infer<typeof proxyExecuteResponseSchema>;

// ── API Surface interfaces (contain functions — cannot be Zod) ──────────────────

export interface ApiEndpoint {
  /**
   * Optional auth override for this endpoint.
   * When present, the platform calls this instead of the default oauth.getActiveToken flow.
   * Receives the provider config (typed as unknown — platform erases generics).
   * Use for endpoints that require different credentials than the per-installation token
   * (e.g. GitHub App JWT for app-level endpoints, basic auth, API key, etc.).
   */
  readonly buildAuth?: (config: unknown) => Promise<string>;
  /** Human-readable description */
  readonly description: string;
  /** HTTP method */
  readonly method: "GET" | "POST";
  /** URL path template with {param} placeholders. Example: "/repos/{owner}/{repo}/pulls" */
  readonly path: string;
  /** Zod schema for the response body. Uses .passthrough() to allow extra fields. */
  readonly responseSchema: z.ZodType;
  /** Request timeout in ms. Default: 30_000 */
  readonly timeout?: number;
}

export interface ProviderApi {
  /** Base URL for the provider's API. Example: "https://api.github.com" */
  readonly baseUrl: string;
  /** Build the Authorization header value from the active token.
   *  Default behavior (when omitted): `Bearer ${token}`. */
  readonly buildAuthHeader?: (token: string) => string;
  /** Default headers for all API calls. */
  readonly defaultHeaders?: Record<string, string>;
  /** Available API endpoints, keyed by a stable identifier */
  readonly endpoints: Record<string, ApiEndpoint>;
  /** Parse rate-limit info from response headers. Return null if not parseable.
   *  This is an API-level concern — consumed by callers, never by the platform proxy. */
  readonly parseRateLimit: (headers: Headers) => RateLimit | null;
}

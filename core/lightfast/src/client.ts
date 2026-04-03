import { LIGHTFAST_API_KEY_PREFIX } from "./constants";
import {
  AuthenticationError,
  LightfastError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  ValidationError,
} from "./errors";
import type {
  LightfastConfig,
  ProxyExecuteInput,
  ProxyExecuteResponse,
  ProxySearchResponse,
  SearchInput,
  SearchResponse,
} from "./types";

const DEFAULT_BASE_URL = "https://lightfast.ai";
const DEFAULT_TIMEOUT = 30_000;

declare const __SDK_VERSION__: string;
const SDK_VERSION = __SDK_VERSION__;

/**
 * Error response structure from the API
 */
interface ApiErrorResponse {
  details?: Record<string, string[]>;
  error?: string;
  message?: string;
  requestId?: string;
}

/**
 * Lightfast SDK client — surfaces decisions across your tools
 *
 * @example
 * ```typescript
 * const lightfast = new Lightfast({ apiKey: "sk-lf-..." });
 * const results = await lightfast.search({ query: "authentication" });
 * ```
 */
export class Lightfast {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(config: LightfastConfig) {
    if (!config.apiKey) {
      throw new Error("API key is required");
    }
    if (!config.apiKey.startsWith(LIGHTFAST_API_KEY_PREFIX)) {
      throw new Error(
        `Invalid API key format. Keys should start with '${LIGHTFAST_API_KEY_PREFIX}'`
      );
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Search through org decisions and observations
   *
   * @param request - Search parameters
   * @returns Search results with scores and metadata
   *
   * @example
   * ```typescript
   * const results = await lightfast.search({
   *   query: "user authentication",
   *   mode: "balanced",
   *   limit: 10,
   * });
   * ```
   */
  async search(request: SearchInput): Promise<SearchResponse> {
    return this.request<SearchResponse>("/v1/search", {
      query: request.query,
      limit: request.limit ?? 10,
      offset: request.offset ?? 0,
      mode: request.mode ?? "balanced",
      filters: request.filters,
    });
  }

  /**
   * Discover all available provider API endpoints across connected providers
   *
   * @returns All connected providers and their available API endpoints
   */
  async proxySearch(): Promise<ProxySearchResponse> {
    return this.request<ProxySearchResponse>("/v1/proxy/search", {});
  }

  /**
   * Execute a provider API call through the Lightfast proxy
   *
   * Auth is handled automatically — the proxy injects the correct token.
   *
   * @param request - Provider, endpoint, and parameters
   * @returns Raw provider API response
   */
  async proxyExecute(
    request: ProxyExecuteInput
  ): Promise<ProxyExecuteResponse> {
    return this.request<ProxyExecuteResponse>("/v1/proxy/execute", {
      installationId: request.installationId,
      endpointId: request.endpointId,
      pathParams: request.pathParams,
      queryParams: request.queryParams,
      body: request.body,
    });
  }

  /**
   * Make an HTTP request to the Lightfast API
   */
  private async request<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": `lightfast/${SDK_VERSION}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data: unknown = await response.json();

      if (!response.ok) {
        throw this.handleErrorResponse(
          response.status,
          data as ApiErrorResponse
        );
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof LightfastError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new NetworkError(`Request timeout after ${this.timeout}ms`);
        }
        throw new NetworkError(error.message, error);
      }

      throw new NetworkError("Unknown network error", error);
    }
  }

  /**
   * Convert HTTP error response to appropriate error class
   */
  private handleErrorResponse(
    status: number,
    data: ApiErrorResponse
  ): LightfastError {
    const message = data.error ?? data.message ?? "Unknown error";
    const requestId = data.requestId;

    switch (status) {
      case 400:
        return new ValidationError(message, data.details, requestId);
      case 401:
        return new AuthenticationError(message, requestId);
      case 404:
        return new NotFoundError(message, requestId);
      case 429:
        return new RateLimitError(message, undefined, requestId);
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServerError(message, requestId);
      default:
        return new LightfastError("UNKNOWN_ERROR", message, requestId, status);
    }
  }
}

/**
 * Create a new Lightfast client
 *
 * @param config - Client configuration
 * @returns Lightfast instance
 *
 * @example
 * ```typescript
 * const lightfast = createLightfast({ apiKey: "sk-lf-..." });
 * ```
 */
export function createLightfast(config: LightfastConfig): Lightfast {
  return new Lightfast(config);
}

/**
 * @deprecated Use `Lightfast` instead
 */
export const LightfastMemory = Lightfast;

/**
 * @deprecated Use `createLightfast` instead
 */
export const createLightfastMemory = createLightfast;

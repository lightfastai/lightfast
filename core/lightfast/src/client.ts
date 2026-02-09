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
  ContentsInput,
  FindSimilarInput,
  GraphInput,
  LightfastConfig,
  RelatedInput,
  SearchInput,
  V1ContentsResponse,
  V1FindSimilarResponse,
  V1SearchResponse,
  GraphResponse,
  RelatedResponse,
} from "./types";

const DEFAULT_BASE_URL = "https://lightfast.ai";
const DEFAULT_TIMEOUT = 30000;

declare const __SDK_VERSION__: string;
const SDK_VERSION = __SDK_VERSION__;

/**
 * Error response structure from the API
 */
interface ApiErrorResponse {
  error?: string;
  message?: string;
  requestId?: string;
  details?: Record<string, string[]>;
}

/**
 * Lightfast SDK client for Neural Memory API
 *
 * @example
 * ```typescript
 * const lightfast = new Lightfast({ apiKey: "sk_live_..." });
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
    if (!config.apiKey.startsWith("sk_")) {
      throw new Error("Invalid API key format. Keys should start with 'sk_'");
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
  }

  /**
   * Search through workspace neural memory
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
  async search(request: SearchInput): Promise<V1SearchResponse> {
    return this.request<V1SearchResponse>("/v1/search", {
      query: request.query,
      limit: request.limit ?? 10,
      offset: request.offset ?? 0,
      mode: request.mode ?? "balanced",
      filters: request.filters,
      includeContext: request.includeContext ?? true,
      includeHighlights: request.includeHighlights ?? true,
    });
  }

  /**
   * Fetch full content for documents and observations by ID
   *
   * @param request - Content IDs to fetch
   * @returns Full content items and list of missing IDs
   *
   * @example
   * ```typescript
   * const content = await lightfast.contents({
   *   ids: ["doc_abc123", "obs_def456"],
   * });
   * ```
   */
  async contents(request: ContentsInput): Promise<V1ContentsResponse> {
    return this.request<V1ContentsResponse>("/v1/contents", {
      ids: request.ids,
    });
  }

  /**
   * Find content semantically similar to a given document or URL
   *
   * @param request - Source ID or URL and similarity parameters
   * @returns Similar items with similarity scores
   *
   * @example
   * ```typescript
   * const similar = await lightfast.findSimilar({
   *   id: "doc_abc123",
   *   limit: 5,
   *   threshold: 0.7,
   * });
   * ```
   */
  async findSimilar(request: FindSimilarInput): Promise<V1FindSimilarResponse> {
    if (!request.id && !request.url) {
      throw new ValidationError("Either 'id' or 'url' must be provided");
    }

    return this.request<V1FindSimilarResponse>("/v1/findsimilar", {
      id: request.id,
      url: request.url,
      limit: request.limit ?? 10,
      threshold: request.threshold ?? 0.5,
      sameSourceOnly: request.sameSourceOnly ?? false,
      excludeIds: request.excludeIds,
      filters: request.filters,
    });
  }

  /**
   * Traverse the relationship graph from a starting observation
   *
   * @param request - Graph traversal parameters
   * @returns Graph nodes, edges, and metadata
   *
   * @example
   * ```typescript
   * const graph = await lightfast.graph({
   *   id: "obs_abc123",
   *   depth: 2,
   *   types: ["fixes", "deploys"],
   * });
   * ```
   */
  async graph(request: GraphInput): Promise<GraphResponse> {
    return this.request<GraphResponse>("/v1/graph", {
      id: request.id,
      depth: request.depth ?? 2,
      types: request.types,
    });
  }

  /**
   * Find observations directly connected via relationships
   *
   * @param request - Source observation ID
   * @returns Related observations grouped by source
   *
   * @example
   * ```typescript
   * const related = await lightfast.related({
   *   id: "obs_abc123",
   * });
   * ```
   */
  async related(request: RelatedInput): Promise<RelatedResponse> {
    return this.request<RelatedResponse>("/v1/related", {
      id: request.id,
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
          data as ApiErrorResponse,
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
    data: ApiErrorResponse,
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
 * const lightfast = createLightfast({ apiKey: "sk_live_..." });
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

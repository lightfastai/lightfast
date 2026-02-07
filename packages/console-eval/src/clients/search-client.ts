/**
 * HTTP client for /v1/search API
 *
 * Calls production search endpoint with eval workspace credentials.
 */

// Using simplified types to avoid import issues
export interface V1SearchResponse {
  results: Array<{
    externalId: string;
    title: string;
    body: string;
    score?: number;
    sourceType: string;
    occurredAt: string;
  }>;
  total: number;
  query: string;
}

export interface SearchConfig {
  apiUrl: string;         // e.g., "http://localhost:3024" or "https://api.lightfast.ai"
  apiKey: string;         // Eval workspace API key
  workspaceId: string;    // Eval workspace ID
}

export interface SearchOptions {
  query: string;
  mode?: "fast" | "balanced" | "thorough";
  limit?: number;
  offset?: number;
}

/**
 * Call /v1/search API
 */
export async function searchAPI(
  options: SearchOptions,
  config: SearchConfig
): Promise<V1SearchResponse> {
  const url = new URL("/v1/search", config.apiUrl);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.apiKey}`,
      "X-Workspace-ID": config.workspaceId,
    },
    body: JSON.stringify({
      query: options.query,
      mode: options.mode ?? "balanced",
      limit: options.limit ?? 10,
      offset: options.offset ?? 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data as V1SearchResponse;
}

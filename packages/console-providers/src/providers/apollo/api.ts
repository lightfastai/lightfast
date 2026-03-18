import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../provider/api";

function parseApolloRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-rate-limit-remaining");
  const reset = headers.get("x-rate-limit-reset");
  const limit = headers.get("x-rate-limit-limit");
  if (!(remaining && reset && limit)) {
    return null;
  }
  const r = Number.parseInt(remaining, 10);
  const s = Number.parseInt(reset, 10) * 1000; // Apollo returns epoch seconds
  const l = Number.parseInt(limit, 10);
  if (Number.isNaN(r) || Number.isNaN(s) || Number.isNaN(l)) {
    return null;
  }
  return { remaining: r, resetAt: new Date(s), limit: l };
}

export const apolloApi = {
  baseUrl: "https://api.apollo.io/api/v1",
  buildAuthHeader: (apiKey: string) => `Api-Key ${apiKey}`,
  defaultHeaders: {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
  },
  parseRateLimit: parseApolloRateLimit,
  endpoints: {
    "search-people": {
      description: "Search for people in Apollo",
      method: "POST",
      path: "/mixed_people/search",
      responseSchema: z.unknown(),
      timeout: 30_000,
    },
    "search-organizations": {
      description: "Search for organizations in Apollo",
      method: "POST",
      path: "/mixed_companies/search",
      responseSchema: z.unknown(),
      timeout: 30_000,
    },
    "get-account": {
      description: "Get organization account details",
      method: "GET",
      path: "/accounts/{account_id}",
      responseSchema: z.unknown(),
      timeout: 15_000,
    },
  },
} as const satisfies ProviderApi;

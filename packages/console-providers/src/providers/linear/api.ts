import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";

// ── Rate Limit Parser ───────────────────────────────────────────────────────────

export function parseLinearRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-ratelimit-requests-remaining");
  const reset = headers.get("x-ratelimit-requests-reset");
  const limit = headers.get("x-ratelimit-requests-limit");
  if (!(remaining && reset && limit)) {
    return null;
  }
  const r = Number.parseInt(remaining, 10);
  const s = Number.parseInt(reset, 10); // Linear returns UTC epoch MILLISECONDS
  const l = Number.parseInt(limit, 10);
  if (Number.isNaN(r) || Number.isNaN(s) || Number.isNaN(l)) {
    return null;
  }
  return { remaining: r, resetAt: new Date(s), limit: l }; // s is already in ms
}

// ── Response Schemas ────────────────────────────────────────────────────────────

export const graphqlResponseSchema = z.object({
  data: z.unknown(),
  errors: z
    .array(
      z.object({
        message: z.string(),
        locations: z
          .array(z.object({ line: z.number(), column: z.number() }))
          .optional(),
        path: z.array(z.union([z.string(), z.number()])).optional(),
      })
    )
    .optional(),
});

// ── API Definition ──────────────────────────────────────────────────────────────

export const linearApi = {
  baseUrl: "https://api.linear.app",
  defaultHeaders: { "Content-Type": "application/json" },
  parseRateLimit: parseLinearRateLimit,
  endpoints: {
    graphql: {
      method: "POST",
      path: "/graphql",
      description: "Linear GraphQL API",
      responseSchema: graphqlResponseSchema,
    },
  },
} as const satisfies ProviderApi;

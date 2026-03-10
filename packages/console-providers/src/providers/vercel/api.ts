import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";

// ── Response Schemas ────────────────────────────────────────────────────────────

export const vercelDeploymentSchema = z
  .object({
    uid: z.string(),
    name: z.string(),
    url: z.string().optional(),
    created: z.number(),
    readyState: z.string().optional(),
    state: z.string().optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    creator: z.object({ uid: z.string() }).passthrough().optional(),
    projectId: z.string().optional(),
  })
  .passthrough();

export const vercelDeploymentsResponseSchema = z.object({
  deployments: z.array(vercelDeploymentSchema),
  pagination: z.object({
    count: z.number(),
    next: z.number().nullable(),
    prev: z.number().nullable(),
  }),
});

// ── Rate Limit Parser ───────────────────────────────────────────────────────────

export function parseVercelRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const limit = headers.get("x-ratelimit-limit");
  if (!(remaining && reset && limit)) {
    return null;
  }
  const r = Number.parseInt(remaining, 10);
  const s = Number.parseInt(reset, 10);
  const l = Number.parseInt(limit, 10);
  if (Number.isNaN(r) || Number.isNaN(s) || Number.isNaN(l)) {
    return null;
  }
  return { remaining: r, resetAt: new Date(s * 1000), limit: l };
}

// ── API Definition ──────────────────────────────────────────────────────────────

export const vercelApi: ProviderApi = {
  baseUrl: "https://api.vercel.com",
  parseRateLimit: parseVercelRateLimit,
  endpoints: {
    "list-deployments": {
      method: "GET",
      path: "/v6/deployments",
      description: "List deployments for a project",
      responseSchema: vercelDeploymentsResponseSchema,
    },
  },
} as const;

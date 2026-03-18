import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";

// ── Response Schemas ────────────────────────────────────────────────────────────

export const vercelDeploymentSchema = z
  .object({
    uid: z.string(),
    name: z.string(),
    url: z.string().nullish(),
    created: z.number(),
    readyState: z
      .enum([
        "BUILDING",
        "ERROR",
        "INITIALIZING",
        "QUEUED",
        "READY",
        "CANCELED",
      ])
      .optional(),
    meta: z
      .object({
        githubCommitRef: z.string().optional(),
        githubCommitSha: z.string().optional(),
        githubCommitMessage: z.string().optional(),
        githubOrg: z.string().optional(),
        githubRepo: z.string().optional(),
      })
      .loose()
      .optional(),
    projectId: z.string().optional(),
  })
  .loose();

export const vercelDeploymentsResponseSchema = z.object({
  deployments: z.array(vercelDeploymentSchema),
  pagination: z.object({
    count: z.number(),
    next: z.number().nullable(),
    prev: z.number().nullable(),
  }),
});

export const vercelProjectsListSchema = z.object({
  projects: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        framework: z.string().nullable().optional(),
        updatedAt: z.number().optional(),
      })
      .loose()
  ),
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

export const vercelApi = {
  baseUrl: "https://api.vercel.com",
  parseRateLimit: parseVercelRateLimit,
  endpoints: {
    "get-team": {
      method: "GET",
      path: "/v2/teams/{team_id}",
      description: "Get Vercel team details by team ID",
      responseSchema: z.record(z.string(), z.unknown()),
    },
    "get-user": {
      method: "GET",
      path: "/v2/user",
      description: "Get the authenticated Vercel user",
      responseSchema: z
        .object({ user: z.record(z.string(), z.unknown()).optional() })
        .loose(),
    },
    "list-projects": {
      method: "GET",
      path: "/v9/projects",
      description: "List Vercel projects for a team or personal account",
      responseSchema: vercelProjectsListSchema,
    },
    "list-deployments": {
      method: "GET",
      path: "/v6/deployments",
      description: "List deployments for a project",
      responseSchema: vercelDeploymentsResponseSchema,
    },
  },
} as const satisfies ProviderApi;

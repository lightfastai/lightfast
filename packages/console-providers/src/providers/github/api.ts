import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";

// ── Response Schemas ────────────────────────────────────────────────────────────

export const githubUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string().optional(),
  html_url: z.string().optional(),
}).passthrough();

export const githubPullRequestSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.string(),
  body: z.string().nullable(),
  user: githubUserSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  merged_at: z.string().nullable(),
  merged: z.boolean().optional(),
  html_url: z.string(),
  head: z.object({ ref: z.string(), sha: z.string() }).passthrough(),
  base: z.object({ ref: z.string(), sha: z.string() }).passthrough(),
}).passthrough();

export const githubIssueSchema = z.object({
  number: z.number(),
  title: z.string(),
  state: z.string(),
  body: z.string().nullable(),
  user: githubUserSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  html_url: z.string(),
  pull_request: z.unknown().optional(),
  labels: z.array(z.object({ name: z.string() }).passthrough()).optional(),
}).passthrough();

export const githubReleaseSchema = z.object({
  id: z.number(),
  tag_name: z.string(),
  name: z.string().nullable(),
  body: z.string().nullable(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  author: githubUserSchema.nullable(),
  created_at: z.string(),
  published_at: z.string().nullable(),
  html_url: z.string(),
}).passthrough();

// ── Rate Limit Parser ───────────────────────────────────────────────────────────

export function parseGitHubRateLimit(headers: Headers): RateLimit | null {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  const limit = headers.get("x-ratelimit-limit");
  if (!remaining || !reset || !limit) return null;
  const r = parseInt(remaining, 10);
  const s = parseInt(reset, 10);
  const l = parseInt(limit, 10);
  if (Number.isNaN(r) || Number.isNaN(s) || Number.isNaN(l)) return null;
  return { remaining: r, resetAt: new Date(s * 1000), limit: l };
}

// ── API Definition ──────────────────────────────────────────────────────────────

export const githubApi: ProviderApi = {
  baseUrl: "https://api.github.com",
  defaultHeaders: { Accept: "application/vnd.github.v3+json" },
  parseRateLimit: parseGitHubRateLimit,
  endpoints: {
    "list-pull-requests": {
      method: "GET",
      path: "/repos/{owner}/{repo}/pulls",
      description: "List pull requests for a repository",
      responseSchema: z.array(githubPullRequestSchema),
    },
    "list-issues": {
      method: "GET",
      path: "/repos/{owner}/{repo}/issues",
      description: "List issues for a repository (includes PRs — filter client-side)",
      responseSchema: z.array(githubIssueSchema),
    },
    "list-releases": {
      method: "GET",
      path: "/repos/{owner}/{repo}/releases",
      description: "List releases for a repository",
      responseSchema: z.array(githubReleaseSchema),
    },
  },
} as const;

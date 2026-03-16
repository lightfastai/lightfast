import { z } from "zod";
import type { ProviderApi, RateLimit } from "../../define";
import { createRS256JWT } from "../../jwt";
import type { GitHubConfig } from "./auth";

// ── Response Schemas ────────────────────────────────────────────────────────────

export const githubUserSchema = z
  .object({
    login: z.string(),
    id: z.number(),
    avatar_url: z.string().optional(),
    html_url: z.string().optional(),
  })
  .loose();

export const githubPullRequestSchema = z
  .object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    state: z.string(),
    body: z.string().nullable(),
    user: githubUserSchema.nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    merged_at: z.string().nullable(),
    merged: z.boolean().nullable().optional(),
    merge_commit_sha: z.string().nullable(),
    draft: z.boolean(),
    html_url: z.string(),
    head: z.object({ ref: z.string(), sha: z.string() }).loose(),
    base: z.object({ ref: z.string(), sha: z.string() }).loose(),
    // List API omits these — present only on individual PR fetch
    additions: z.number().optional(),
    deletions: z.number().optional(),
    changed_files: z.number().optional(),
  })
  .loose();

export const githubIssueSchema = z
  .object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    state: z.string(),
    state_reason: z.string().nullable().optional(),
    body: z.string().nullable(),
    user: githubUserSchema.nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    closed_at: z.string().nullable(),
    html_url: z.string(),
    pull_request: z.unknown().optional(),
    labels: z.array(z.object({ name: z.string() }).loose()).optional(),
  })
  .loose();

export const githubAppInstallationSchema = z
  .object({
    id: z.number(),
    account: z
      .object({
        login: z.string(),
        type: z.string(),
        avatar_url: z.string().optional(),
      })
      .nullable()
      .optional(),
  })
  .loose();

// ── App JWT Builder ──────────────────────────────────────────────────────────────

async function buildGitHubAppAuth(config: unknown): Promise<string> {
  const c = config as GitHubConfig;
  const now = Math.floor(Date.now() / 1000);
  return createRS256JWT(
    { iss: c.appId, iat: now - 60, exp: now + 600 },
    c.privateKey
  );
}

// ── Rate Limit Parser ───────────────────────────────────────────────────────────

export function parseGitHubRateLimit(headers: Headers): RateLimit | null {
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

export const githubInstallationReposSchema = z
  .object({
    total_count: z.number(),
    repositories: z.array(
      z
        .object({
          id: z.number(),
          name: z.string(),
          full_name: z.string(),
          private: z.boolean(),
          description: z.string().nullable(),
          default_branch: z.string(),
          archived: z.boolean(),
          html_url: z.string(),
          language: z.string().nullable().optional(),
          stargazers_count: z.number().optional(),
          updated_at: z.string().nullable().optional(),
          owner: z.object({ login: z.string() }).loose(),
        })
        .loose()
    ),
  })
  .loose();

// ── API Definition ──────────────────────────────────────────────────────────────

export const githubApi: ProviderApi = {
  baseUrl: "https://api.github.com",
  defaultHeaders: { Accept: "application/vnd.github.v3+json" },
  parseRateLimit: parseGitHubRateLimit,
  endpoints: {
    "get-app-installation": {
      method: "GET",
      path: "/app/installations/{installation_id}",
      description:
        "Get a GitHub App installation by installation ID (requires App JWT)",
      responseSchema: githubAppInstallationSchema,
      buildAuth: buildGitHubAppAuth,
    },
    "list-installation-repos": {
      method: "GET",
      path: "/installation/repositories",
      description:
        "List repositories accessible to the GitHub App installation",
      responseSchema: githubInstallationReposSchema,
    },
    "get-repo": {
      method: "GET",
      path: "/repos/{owner}/{repo}",
      description: "Get repository metadata including default branch",
      responseSchema: z.object({ default_branch: z.string() }).loose(),
    },
    "get-file-contents": {
      method: "GET",
      path: "/repos/{owner}/{repo}/contents/{path}",
      description: "Get file contents from a repository",
      responseSchema: z.union([
        z
          .object({
            type: z.string(),
            content: z.string(),
            sha: z.string(),
            size: z.number().optional(),
          })
          .loose(),
        z.array(z.object({ type: z.string(), name: z.string() }).loose()),
      ]),
    },
    "list-pull-requests": {
      method: "GET",
      path: "/repos/{owner}/{repo}/pulls",
      description: "List pull requests for a repository",
      responseSchema: z.array(githubPullRequestSchema),
    },
    "list-issues": {
      method: "GET",
      path: "/repos/{owner}/{repo}/issues",
      description:
        "List issues for a repository (includes PRs — filter client-side)",
      responseSchema: z.array(githubIssueSchema),
    },
  },
} as const;

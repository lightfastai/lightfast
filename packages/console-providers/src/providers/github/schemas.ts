import { z } from "zod";

// ─── Shared sub-schemas ──────────────────────────────────────────────────────

const ghUserSchema = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string(),
});

const ghRepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  full_name: z.string(),
  html_url: z.string(),
  private: z.boolean(),
  owner: z.object({ login: z.string() }),
  default_branch: z.string(),
});

// ─── Event schemas ───────────────────────────────────────────────────────────

export const preTransformGitHubPullRequestEventSchema = z.object({
  action: z.string(),
  number: z.number(),
  pull_request: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string(),
    user: ghUserSchema.nullable(),
    head: z.object({ ref: z.string(), sha: z.string() }),
    base: z.object({ ref: z.string(), sha: z.string() }),
    state: z.string(),
    merged: z.boolean().nullable(),
    merge_commit_sha: z.string().nullable(),
    draft: z.boolean(),
    additions: z.number(),
    deletions: z.number(),
    changed_files: z.number(),
    created_at: z.string(),
    updated_at: z.string(),
    closed_at: z.string().nullable().optional(),
    merged_at: z.string().nullable().optional(),
    requested_reviewers: z.array(z.object({ login: z.string() })).optional(),
    assignees: z.array(z.object({ login: z.string() })).optional(),
    labels: z.array(z.object({ name: z.string() })).optional(),
  }),
  repository: ghRepositorySchema,
  sender: ghUserSchema,
  installation: z.object({ id: z.number() }).optional(),
});

export const preTransformGitHubIssuesEventSchema = z.object({
  action: z.string(),
  issue: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string(),
    user: ghUserSchema.nullable(),
    state: z.string(),
    state_reason: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    closed_at: z.string().nullable().optional(),
    assignees: z.array(z.object({ login: z.string() })).optional(),
    labels: z.array(z.object({ name: z.string() })).optional(),
  }),
  repository: ghRepositorySchema,
  sender: ghUserSchema,
  installation: z.object({ id: z.number() }).optional(),
});

// ── Relay-level loose webhook payload schema (for signature verification + extraction) ──

export const githubWebhookPayloadSchema = z
  .object({
    repository: z.object({ id: z.union([z.string(), z.number()]) }).optional(),
    installation: z
      .object({ id: z.union([z.string(), z.number()]) })
      .optional(),
  })
  .passthrough();

// ─── Inferred types ──────────────────────────────────────────────────────────

export type PreTransformGitHubPullRequestEvent = z.infer<
  typeof preTransformGitHubPullRequestEventSchema
>;
export type PreTransformGitHubIssuesEvent = z.infer<
  typeof preTransformGitHubIssuesEventSchema
>;
export type GitHubWebhookPayload = z.infer<typeof githubWebhookPayloadSchema>;

export const githubWebhookEventTypeSchema = z.enum(["pull_request", "issues"]);
export type GitHubWebhookEventType = z.infer<
  typeof githubWebhookEventTypeSchema
>;

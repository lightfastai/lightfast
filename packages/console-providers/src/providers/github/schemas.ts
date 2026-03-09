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

const ghCommitSchema = z.object({
  id: z.string(),
  message: z.string(),
  timestamp: z.string(),
  url: z.string(),
  author: z.object({
    name: z.string(),
    email: z.string(),
    username: z.string().optional(),
  }),
  committer: z.object({
    name: z.string(),
    email: z.string(),
    username: z.string().optional(),
  }),
  distinct: z.boolean(),
  added: z.array(z.string()),
  removed: z.array(z.string()),
  modified: z.array(z.string()),
});

// ─── Event schemas ───────────────────────────────────────────────────────────

export const preTransformGitHubPushEventSchema = z.object({
  ref: z.string(),
  before: z.string(),
  after: z.string(),
  created: z.boolean(),
  deleted: z.boolean(),
  forced: z.boolean(),
  compare: z.string(),
  base_ref: z.string().nullable(),
  head_commit: ghCommitSchema.nullable(),
  commits: z.array(ghCommitSchema),
  pusher: z.object({ name: z.string(), email: z.string().nullable() }),
  repository: ghRepositorySchema,
  sender: ghUserSchema,
  installation: z.object({ id: z.number() }).optional(),
});

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

export const preTransformGitHubReleaseEventSchema = z.object({
  action: z.string(),
  release: z.object({
    id: z.number(),
    tag_name: z.string(),
    target_commitish: z.string(),
    name: z.string().nullable(),
    body: z.string().nullable(),
    html_url: z.string(),
    author: ghUserSchema,
    created_at: z.string(),
    published_at: z.string().nullable(),
    prerelease: z.boolean(),
    draft: z.boolean(),
  }),
  repository: ghRepositorySchema,
  sender: ghUserSchema,
  installation: z.object({ id: z.number() }).optional(),
});

export const preTransformGitHubDiscussionEventSchema = z.object({
  action: z.string(),
  discussion: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    body: z.string().nullable(),
    html_url: z.string(),
    user: ghUserSchema,
    state: z.string(),
    state_reason: z.string().nullable().optional(),
    locked: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    answer_html_url: z.string().nullable(),
    answer_chosen_at: z.string().nullable().optional(),
    answer_chosen_by: ghUserSchema.nullable().optional(),
    category: z.object({ name: z.string() }),
    comments: z.number().optional(),
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

export type PreTransformGitHubPushEvent = z.infer<
  typeof preTransformGitHubPushEventSchema
>;
export type PreTransformGitHubPullRequestEvent = z.infer<
  typeof preTransformGitHubPullRequestEventSchema
>;
export type PreTransformGitHubIssuesEvent = z.infer<
  typeof preTransformGitHubIssuesEventSchema
>;
export type PreTransformGitHubReleaseEvent = z.infer<
  typeof preTransformGitHubReleaseEventSchema
>;
export type PreTransformGitHubDiscussionEvent = z.infer<
  typeof preTransformGitHubDiscussionEventSchema
>;
export type GitHubWebhookPayload = z.infer<typeof githubWebhookPayloadSchema>;

export type GitHubWebhookEventType =
  | "push"
  | "pull_request"
  | "issues"
  | "release"
  | "discussion";

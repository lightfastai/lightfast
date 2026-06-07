import { z } from "zod";

export const GITHUB_SETUP_PATH = "/api/github/setup";
export const GITHUB_OAUTH_CALLBACK_PATH = "/api/github/oauth/callback";
export const GITHUB_USER_ACCOUNT_OAUTH_CALLBACK_PATH =
  "/api/github/user/oauth/callback";
export const GITHUB_WEBHOOK_PATH = "/api/github/webhook";

export const GITHUB_BIND_ERROR_CODES = [
  "expired_state",
  "installation_not_verified",
  "personal_account_not_supported",
  "permission_required",
  "installation_already_bound",
  "org_already_bound",
  "saml_session_required",
  "github_authorization_denied",
  "github_transient_error",
] as const;

export const githubBindErrorCodeSchema = z.enum(GITHUB_BIND_ERROR_CODES);
export type GitHubBindErrorCode = z.infer<typeof githubBindErrorCodeSchema>;

export const GITHUB_USER_ACCOUNT_BIND_ERROR_CODES = [
  "expired_state",
  "github_authorization_denied",
  "github_transient_error",
  "github_user_not_verified",
  "missing_refresh_token",
  "github_account_already_bound",
  "lightfast_user_already_bound",
  "permission_required",
] as const;

export const githubUserAccountBindErrorCodeSchema = z.enum(
  GITHUB_USER_ACCOUNT_BIND_ERROR_CODES
);
export type GitHubUserAccountBindErrorCode = z.infer<
  typeof githubUserAccountBindErrorCodeSchema
>;

export const GITHUB_USER_ACCOUNT_RETURN_TO_MAX_LENGTH = 512;

export function isGitHubUserAccountReturnTo(value: string): boolean {
  return (
    value.length <= GITHUB_USER_ACCOUNT_RETURN_TO_MAX_LENGTH &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  );
}

export function normalizeGitHubUserAccountReturnTo(
  value: null | string | undefined
): string | undefined {
  if (!value) {
    return;
  }

  return isGitHubUserAccountReturnTo(value) ? value : undefined;
}

export const githubUserAccountReturnToSchema = z
  .string()
  .max(GITHUB_USER_ACCOUNT_RETURN_TO_MAX_LENGTH)
  .refine(isGitHubUserAccountReturnTo, {
    message: "returnTo must be an internal absolute path",
  });
export type GitHubUserAccountReturnTo = z.infer<
  typeof githubUserAccountReturnToSchema
>;

export const githubBindStartOutputSchema = z.object({
  installationUrl: z.string().url(),
});
export type GitHubBindStartOutput = z.infer<typeof githubBindStartOutputSchema>;

export const githubNormalizedInstallationSchema = z.object({
  account: z.object({
    id: z.string().min(1),
    login: z.string().min(1),
    type: z.enum(["Organization", "User"]),
  }),
  appId: z.string().min(1),
  appSlug: z.string().min(1).nullable(),
  events: z.array(z.string()),
  id: z.string().min(1),
  permissions: z.record(z.string(), z.string()),
  repositorySelection: z.enum(["all", "selected"]),
  suspendedAt: z.string().nullable().optional(),
  targetType: z.enum(["Organization", "User"]),
});
export type GitHubNormalizedInstallation = z.infer<
  typeof githubNormalizedInstallationSchema
>;

const githubInstallationMetadataBaseSchema = z.object({
  events: z.array(z.string()),
  githubAppId: z.string().min(1),
  githubAppSlug: z.string().min(1).nullable(),
  githubSetupAction: z.string().min(1).optional(),
  permissions: z.record(z.string(), z.string()),
  repositorySelection: z.enum(["all", "selected"]),
});

const legacyEnvironmentProvenanceKey = "verifiedBy";

export const githubInstallationMetadataSchema =
  githubInstallationMetadataBaseSchema
    .catchall(z.unknown())
    .superRefine((value, ctx) => {
      if (legacyEnvironmentProvenanceKey in value) {
        ctx.addIssue({
          code: "custom",
          message: "Environment provenance is not supported",
          path: [legacyEnvironmentProvenanceKey],
        });
      }
    })
    .transform((value) => githubInstallationMetadataBaseSchema.parse(value));
export type GitHubInstallationMetadata = z.infer<
  typeof githubInstallationMetadataSchema
>;

export const githubWebhookHeadersSchema = z.object({
  deliveryId: z.string().min(1),
  event: z.string().min(1),
  signature256: z
    .string()
    .regex(/^sha256=[A-Fa-f0-9]{64}$/, "Expected sha256=<64 hex characters>"),
});
export type GitHubWebhookHeaders = z.infer<typeof githubWebhookHeadersSchema>;

const githubSha1Schema = z
  .string()
  .regex(/^[0-9a-f]{40}$/i, "Expected 40-character SHA-1");

const githubRepositoryFullNameSchema = z
  .string()
  .regex(/^[^/\s]+\/[^/\s]+$/, "Expected repository full name as owner/repo");

const githubWebhookProviderIdSchema = z.union([
  z.number().int().positive().safe(),
  z.string().min(1),
]);

export const githubWebhookInstallationSchema = z.object({
  id: githubWebhookProviderIdSchema,
});

export const githubWebhookRepositorySchema = z.object({
  full_name: githubRepositoryFullNameSchema,
  id: githubWebhookProviderIdSchema,
  name: z.string().min(1),
  owner: z.object({
    login: z.string().min(1),
  }),
});

export const githubPingWebhookPayloadSchema = z.object({
  hook_id: githubWebhookProviderIdSchema.optional(),
  installation: githubWebhookInstallationSchema.optional(),
  repository: githubWebhookRepositorySchema.optional(),
  zen: z.string().optional(),
});
export type GitHubPingWebhookPayload = z.infer<
  typeof githubPingWebhookPayloadSchema
>;

const githubPushWebhookCommitSchema = z.object({
  added: z.array(z.string().min(1)).default([]),
  modified: z.array(z.string().min(1)).default([]),
  removed: z.array(z.string().min(1)).default([]),
});

export const githubPushWebhookPayloadSchema = z.object({
  after: githubSha1Schema,
  before: githubSha1Schema,
  commits: z.array(githubPushWebhookCommitSchema).default([]),
  installation: githubWebhookInstallationSchema,
  ref: z.string().min(1),
  repository: githubWebhookRepositorySchema,
  size: z.number().int().nonnegative().optional(),
});
export type GitHubPushWebhookPayload = z.infer<
  typeof githubPushWebhookPayloadSchema
>;

export const normalizedGitHubPushWebhookSchema = z.object({
  afterSha: githubSha1Schema,
  beforeSha: githubSha1Schema,
  changedPaths: z.array(z.string().min(1)),
  changedPathsComplete: z.boolean(),
  providerInstallationId: z.string().min(1),
  providerRepositoryId: z.string().min(1),
  ref: z.string().min(1),
  repositoryFullName: githubRepositoryFullNameSchema,
});
export type NormalizedGitHubPushWebhook = z.infer<
  typeof normalizedGitHubPushWebhookSchema
>;

export const GITHUB_PR_WEBHOOK_EVENTS = [
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_review_thread",
  "issue_comment",
] as const;

export const githubPrWebhookEventSchema = z.enum(GITHUB_PR_WEBHOOK_EVENTS);
export type GitHubPrWebhookEvent = z.infer<typeof githubPrWebhookEventSchema>;

const githubWebhookActionSchema = z.string().min(1);

const githubWebhookPullRequestRefSchema = z
  .object({
    id: githubWebhookProviderIdSchema.optional(),
    number: z.number().int().positive().optional(),
  })
  .passthrough();

const githubWebhookIssueSchema = z
  .object({
    number: z.number().int().positive().optional(),
    pull_request: z.object({}).passthrough().optional(),
  })
  .passthrough();

const githubWebhookCommentSchema = z
  .object({
    pull_request_url: z.string().url().optional(),
  })
  .passthrough();

export const githubPrWebhookPayloadSchema = z
  .object({
    action: githubWebhookActionSchema,
    comment: githubWebhookCommentSchema.optional(),
    installation: githubWebhookInstallationSchema,
    issue: githubWebhookIssueSchema.optional(),
    pull_request: githubWebhookPullRequestRefSchema.optional(),
    repository: githubWebhookRepositorySchema,
  })
  .passthrough();
export type GitHubPrWebhookPayload = z.infer<
  typeof githubPrWebhookPayloadSchema
>;

export const normalizedGitHubPrWebhookSchema = z.object({
  action: githubWebhookActionSchema,
  event: githubPrWebhookEventSchema,
  providerInstallationId: z.string().min(1),
  providerPullRequestId: z.string().min(1).nullable(),
  providerRepositoryId: z.string().min(1),
  pullRequestNumber: z.number().int().positive(),
});
export type NormalizedGitHubPrWebhook = z.infer<
  typeof normalizedGitHubPrWebhookSchema
>;

function parsePullRequestNumberFromUrl(
  value: string | undefined
): number | null {
  if (!value) {
    return null;
  }
  const match = /\/pulls?\/([1-9][0-9]*)(?:$|[/?#])/.exec(value);
  return match ? Number(match[1]) : null;
}

function requirePullRequestNumber(
  event: GitHubPrWebhookEvent,
  payload: GitHubPrWebhookPayload
): number {
  const number =
    payload.pull_request?.number ??
    payload.issue?.number ??
    parsePullRequestNumberFromUrl(payload.comment?.pull_request_url);

  if (!number) {
    throw new Error(
      `GitHub ${event} webhook payload is missing a pull request number.`
    );
  }
  return number;
}

function getProviderPullRequestId(
  payload: GitHubPrWebhookPayload
): string | null {
  return payload.pull_request?.id === undefined
    ? null
    : String(payload.pull_request.id);
}

export function normalizeGitHubPrWebhookPayload(input: {
  event: GitHubPrWebhookEvent;
  payload: GitHubPrWebhookPayload;
}): NormalizedGitHubPrWebhook | null {
  if (input.event === "issue_comment" && !input.payload.issue?.pull_request) {
    return null;
  }

  return normalizedGitHubPrWebhookSchema.parse({
    action: input.payload.action,
    event: input.event,
    providerInstallationId: String(input.payload.installation.id),
    providerPullRequestId: getProviderPullRequestId(input.payload),
    providerRepositoryId: String(input.payload.repository.id),
    pullRequestNumber: requirePullRequestNumber(input.event, input.payload),
  });
}

export function normalizeGitHubPushWebhookPayload(
  payload: GitHubPushWebhookPayload
): NormalizedGitHubPushWebhook {
  const changedPaths = Array.from(
    new Set(
      payload.commits.flatMap((commit) => [
        ...commit.added,
        ...commit.modified,
        ...commit.removed,
      ])
    )
  );

  return normalizedGitHubPushWebhookSchema.parse({
    afterSha: payload.after,
    beforeSha: payload.before,
    changedPaths,
    changedPathsComplete:
      payload.size === undefined || payload.commits.length >= payload.size,
    providerInstallationId: String(payload.installation.id),
    providerRepositoryId: String(payload.repository.id),
    ref: payload.ref,
    repositoryFullName: payload.repository.full_name,
  });
}

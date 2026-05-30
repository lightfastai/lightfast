import { z } from "zod";

export const GITHUB_SETUP_PATH = "/api/github/setup";
export const GITHUB_OAUTH_CALLBACK_PATH = "/api/github/oauth/callback";
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

export const githubPushWebhookPayloadSchema = z.object({
  after: githubSha1Schema,
  before: githubSha1Schema,
  installation: githubWebhookInstallationSchema,
  ref: z.string().min(1),
  repository: githubWebhookRepositorySchema,
});
export type GitHubPushWebhookPayload = z.infer<
  typeof githubPushWebhookPayloadSchema
>;

export const normalizedGitHubPushWebhookSchema = z.object({
  afterSha: githubSha1Schema,
  beforeSha: githubSha1Schema,
  providerInstallationId: z.string().min(1),
  providerRepositoryId: z.string().min(1),
  ref: z.string().min(1),
  repositoryFullName: githubRepositoryFullNameSchema,
});
export type NormalizedGitHubPushWebhook = z.infer<
  typeof normalizedGitHubPushWebhookSchema
>;

export function normalizeGitHubPushWebhookPayload(
  payload: GitHubPushWebhookPayload
): NormalizedGitHubPushWebhook {
  return normalizedGitHubPushWebhookSchema.parse({
    afterSha: payload.after,
    beforeSha: payload.before,
    providerInstallationId: String(payload.installation.id),
    providerRepositoryId: String(payload.repository.id),
    ref: payload.ref,
    repositoryFullName: payload.repository.full_name,
  });
}

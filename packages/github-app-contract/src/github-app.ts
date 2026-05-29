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
export type GitHubBindStartOutput = z.infer<
  typeof githubBindStartOutputSchema
>;

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

const legacyEnvironmentProvenanceKey = `verified${"By"}`;

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

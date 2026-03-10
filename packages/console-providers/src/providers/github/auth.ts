import { z } from "zod";
import { syncSchema } from "../../types";

// ── Raw OAuth Response Shape ──

/**
 * Raw shape stored in providerAccountInfo.raw for GitHub.
 *
 * Convention: raw = non-secret fields from the token exchange / OAuth response.
 * GitHub App flow has no token exchange response, so raw is empty.
 * Display data (account login, avatar, type) is resolved live in
 * connections.github.list via GET /app/installations/{id}.
 */
export const githubInstallationRawSchema = z.object({});

export type GitHubInstallationRaw = z.infer<typeof githubInstallationRawSchema>;

// ── Account Info Schema ──

export const githubAccountInfoSchema = z.object({
  version: z.literal(1),
  events: z.array(z.string()),
  installedAt: z.string(),
  lastValidatedAt: z.string(),
  sourceType: z.literal("github"),
  raw: githubInstallationRawSchema,
});

export type GitHubAccountInfo = z.infer<typeof githubAccountInfoSchema>;

// ── Config Schema ──

export const githubConfigSchema = z.object({
  appSlug: z.string(),
  appId: z.string(),
  privateKey: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  webhookSecret: z.string(),
});

export type GitHubConfig = z.infer<typeof githubConfigSchema>;

// ── OAuth Response Schema ──

export const githubOAuthResponseSchema = z.union([
  z.object({
    access_token: z.string(),
    token_type: z.string(),
    scope: z.string(),
  }),
  z.object({
    error: z.string(),
    error_description: z.string(),
    error_uri: z.string(),
  }),
]);

// ── Provider Config Schema ──

/**
 * Stable workspace-resource config stored as JSONB in workspace_integrations.provider_config.
 *
 * ONLY stable provider-issued IDs and user-controlled settings belong here.
 *
 * NEVER add display names (repoName, orgName, slug, description, visibility)
 * — these change on the provider side without our involvement and become stale.
 * Resolve display data from a cache layer keyed on the stable IDs stored here.
 */
export const githubProviderConfigSchema = z.object({
  version: z.literal(1),
  sourceType: z.literal("github"),
  type: z.literal("repository"),
  repoId: z.string(),
  sync: syncSchema,
  status: z
    .object({
      configStatus: z.enum(["configured", "awaiting_config"]).optional(),
      configPath: z.string().optional(),
      lastConfigCheck: z.string().optional(),
    })
    .optional(),
});

export type GithubProviderConfig = z.infer<typeof githubProviderConfigSchema>;

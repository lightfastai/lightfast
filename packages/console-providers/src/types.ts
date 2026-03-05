import { z } from "zod";

export interface TransformContext {
  deliveryId: string;
  receivedAt: Date;
  eventType: string;
}

// ── OAuth Types ──

export const oAuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
  scope: z.string().optional(),
  tokenType: z.string().optional(),
  raw: z.record(z.string(), z.unknown()),
});

export type OAuthTokens = z.infer<typeof oAuthTokensSchema>;

export const callbackResultSchema = z.object({
  externalId: z.string(),
  accountInfo: z.object({
    version: z.literal(1),
    sourceType: z.string(),
    events: z.array(z.string()),
    installedAt: z.string(),
    lastValidatedAt: z.string(),
    raw: z.unknown(),
  }).passthrough(),
  tokens: oAuthTokensSchema.optional(),
  setupAction: z.string().optional(),
  nextUrl: z.string().optional(),
});

export type CallbackResult = z.infer<typeof callbackResultSchema>;

// ── Per-Provider Raw API Response Schemas ──

/** Raw shape from GitHub GET /app/installations/{id} */
export const githubInstallationRawSchema = z.object({
  account: z.object({
    login: z.string(),
    id: z.number(),
    type: z.enum(["User", "Organization"]),
    avatar_url: z.string(),
  }),
  permissions: z.record(z.string(), z.string()),
  events: z.array(z.string()),
  created_at: z.string(),
});

export type GitHubInstallationRaw = z.infer<typeof githubInstallationRawSchema>;

/** Raw shape from Vercel POST /v2/oauth/access_token (minus access_token secret) */
export const vercelOAuthRawSchema = z.object({
  token_type: z.string(),
  installation_id: z.string(),
  user_id: z.string(),
  team_id: z.string().nullable(),
});

export type VercelOAuthRaw = z.infer<typeof vercelOAuthRawSchema>;

/** Raw shape from Linear POST /oauth/token (minus access_token secret) */
export const linearOAuthRawSchema = z.object({
  token_type: z.string(),
  scope: z.string(),
  expires_in: z.number(),
});

export type LinearOAuthRaw = z.infer<typeof linearOAuthRawSchema>;

/** Raw shape from Sentry authorization response (minus token/refreshToken secrets) */
export const sentryOAuthRawSchema = z.object({
  expiresAt: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});

export type SentryOAuthRaw = z.infer<typeof sentryOAuthRawSchema>;

// ── Per-Provider Account Info Schemas ──

const baseAccountInfoSchema = z.object({
  version: z.literal(1),
  events: z.array(z.string()),
  installedAt: z.string(),
  lastValidatedAt: z.string(),
});

export const githubAccountInfoSchema = baseAccountInfoSchema.extend({
  sourceType: z.literal("github"),
  raw: githubInstallationRawSchema,
});

export type GitHubAccountInfo = z.infer<typeof githubAccountInfoSchema>;

export const vercelAccountInfoSchema = baseAccountInfoSchema.extend({
  sourceType: z.literal("vercel"),
  raw: vercelOAuthRawSchema,
});

export type VercelAccountInfo = z.infer<typeof vercelAccountInfoSchema>;

export const linearAccountInfoSchema = baseAccountInfoSchema.extend({
  sourceType: z.literal("linear"),
  raw: linearOAuthRawSchema,
  organization: z.object({
    id: z.string(),
    name: z.string().optional(),
    urlKey: z.string().optional(),
  }).optional(),
});

export type LinearAccountInfo = z.infer<typeof linearAccountInfoSchema>;

export const sentryAccountInfoSchema = baseAccountInfoSchema.extend({
  sourceType: z.literal("sentry"),
  raw: sentryOAuthRawSchema,
  installationId: z.string(),
});

export type SentryAccountInfo = z.infer<typeof sentryAccountInfoSchema>;

export const providerAccountInfoSchema = z.discriminatedUnion("sourceType", [
  githubAccountInfoSchema,
  vercelAccountInfoSchema,
  linearAccountInfoSchema,
  sentryAccountInfoSchema,
]);

export type ProviderAccountInfo = z.infer<typeof providerAccountInfoSchema>;

// ── Generic TypedCallbackResult for compile-time narrowing ──

export type TypedCallbackResult<TAccountInfo extends ProviderAccountInfo = ProviderAccountInfo> = {
  externalId: string;
  accountInfo: TAccountInfo;
  tokens?: OAuthTokens;
  setupAction?: string;
  nextUrl?: string;
};

// ── Provider Config Schemas ──

export const githubConfigSchema = z.object({
  appSlug: z.string(),
  appId: z.string(),
  privateKey: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
  webhookSecret: z.string(),
});

export type GitHubConfig = z.infer<typeof githubConfigSchema>;

export const vercelConfigSchema = z.object({
  integrationSlug: z.string(),
  clientSecretId: z.string(),
  clientIntegrationSecret: z.string(),
  callbackBaseUrl: z.string(),
});

export type VercelConfig = z.infer<typeof vercelConfigSchema>;

export const linearConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  webhookSigningSecret: z.string(),
  callbackBaseUrl: z.string(),
});

export type LinearConfig = z.infer<typeof linearConfigSchema>;

export const sentryConfigSchema = z.object({
  appSlug: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
});

export type SentryConfig = z.infer<typeof sentryConfigSchema>;

// ── Sentry Token Encoding ──

export interface SentryInstallationToken {
  installationId: string;
  token: string;
}

export function encodeSentryToken(t: SentryInstallationToken): string {
  if (t.installationId.includes(":")) {
    throw new Error("installationId must not contain ':'");
  }
  return `${t.installationId}:${t.token}`;
}

export function decodeSentryToken(raw: string): SentryInstallationToken {
  const idx = raw.indexOf(":");
  if (idx === -1) {
    throw new Error("Invalid Sentry token: missing ':' separator");
  }
  return { installationId: raw.slice(0, idx), token: raw.slice(idx + 1) };
}

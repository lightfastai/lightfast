import { z } from "zod";
import type { SourceType } from "@repo/console-validation";

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
    sourceType: z.custom<SourceType>(),
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

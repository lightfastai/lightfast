import { z } from "zod";
import { syncSchema } from "../../types";

// ── Raw OAuth Response Shape ──

/**
 * Convention: raw = non-secret fields from the token exchange response.
 * Display data (organization name, slug) is resolved live in
 * connections.sentry.get via GET /api/0/organizations/.
 */
export const sentryOAuthRawSchema = z.object({
  expiresAt: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});

export type SentryOAuthRaw = z.infer<typeof sentryOAuthRawSchema>;

// ── Account Info Schema ──

export const sentryAccountInfoSchema = z.object({
  version: z.literal(1),
  events: z.array(z.string()),
  installedAt: z.string(),
  lastValidatedAt: z.string(),
  sourceType: z.literal("sentry"),
  raw: sentryOAuthRawSchema,
  installationId: z.string(),
});

export type SentryAccountInfo = z.infer<typeof sentryAccountInfoSchema>;

// ── Config Schema ──

export const sentryConfigSchema = z.object({
  appSlug: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
});

export type SentryConfig = z.infer<typeof sentryConfigSchema>;

// ── OAuth Response Schema ──

export const sentryOAuthResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
  scopes: z.array(z.string()).optional(),
});

// ── Sentry Token Encoding ──

export const sentryInstallationTokenSchema = z.object({
  installationId: z.string(),
  token: z.string(),
});
export type SentryInstallationToken = z.infer<
  typeof sentryInstallationTokenSchema
>;

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

// ── Provider Config Schema ──

/** @see githubProviderConfigSchema for design invariants */
export const sentryProviderConfigSchema = z.object({
  provider: z.literal("sentry"),
  type: z.literal("project"),
  sync: syncSchema,
});

export type SentryProviderConfig = z.infer<typeof sentryProviderConfigSchema>;

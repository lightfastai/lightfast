import { z } from "zod";

// ── Raw OAuth Response Shape ──

/** Raw shape from Sentry authorization response (minus token/refreshToken secrets) */
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

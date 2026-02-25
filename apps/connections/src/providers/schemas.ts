import { z } from "zod";

// ── OAuth Response Schemas ──

export const githubOAuthResponseSchema = z.object({
  access_token: z.string(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

export const vercelOAuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
});

export const linearOAuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  scope: z.string().optional(),
  expires_in: z.number().optional(),
});

export const sentryOAuthResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
});

// ── Sentry Installation Token ──

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

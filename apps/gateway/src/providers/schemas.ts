import { z } from "zod";

// ── Webhook Payload Schemas (.passthrough() for forward-compat) ──

export const githubWebhookPayloadSchema = z
  .object({
    repository: z
      .object({ id: z.union([z.string(), z.number()]) })
      .optional(),
    installation: z
      .object({ id: z.union([z.string(), z.number()]) })
      .optional(),
  })
  .passthrough();

export const vercelWebhookPayloadSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional(),
    payload: z
      .object({
        project: z
          .object({ id: z.union([z.string(), z.number()]) })
          .optional(),
        team: z
          .object({ id: z.union([z.string(), z.number()]) })
          .optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const linearWebhookPayloadSchema = z
  .object({
    type: z.string().optional(),
    action: z.string().optional(),
    organizationId: z.string().optional(),
  })
  .passthrough();

export const sentryWebhookPayloadSchema = z
  .object({
    installation: z.object({ uuid: z.string() }).optional(),
  })
  .passthrough();

// ── Inferred webhook payload types ──

export type GitHubWebhookPayload = z.infer<typeof githubWebhookPayloadSchema>;
export type VercelWebhookPayload = z.infer<typeof vercelWebhookPayloadSchema>;
export type LinearWebhookPayload = z.infer<typeof linearWebhookPayloadSchema>;
export type SentryWebhookPayload = z.infer<typeof sentryWebhookPayloadSchema>;

/** Union of all webhook payloads */
export type WebhookPayload =
  | GitHubWebhookPayload
  | VercelWebhookPayload
  | LinearWebhookPayload
  | SentryWebhookPayload;

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
  return `${t.installationId}:${t.token}`;
}

export function decodeSentryToken(raw: string): SentryInstallationToken {
  const idx = raw.indexOf(":");
  if (idx === -1) return { installationId: "", token: raw };
  return { installationId: raw.slice(0, idx), token: raw.slice(idx + 1) };
}

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

/**
 * Union of all webhook payloads.
 *
 * Not a discriminated union — narrowing is handled by the provider strategy
 * pattern: each {@link WebhookProvider} implementation knows its own payload
 * type and casts internally. Use {@link WebhookPayloadFor<N>} when you need
 * compile-time narrowing by provider name.
 */
export type WebhookPayload =
  | GitHubWebhookPayload
  | VercelWebhookPayload
  | LinearWebhookPayload
  | SentryWebhookPayload;

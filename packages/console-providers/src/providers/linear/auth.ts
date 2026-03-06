import { z } from "zod";

// ── Raw OAuth Response Shape ──

/** Raw shape from Linear POST /oauth/token (minus access_token secret) */
export const linearOAuthRawSchema = z.object({
  token_type: z.string(),
  scope: z.string(),
  expires_in: z.number(),
});

export type LinearOAuthRaw = z.infer<typeof linearOAuthRawSchema>;

// ── Account Info Schema ──

export const linearAccountInfoSchema = z.object({
  version: z.literal(1),
  events: z.array(z.string()),
  installedAt: z.string(),
  lastValidatedAt: z.string(),
  sourceType: z.literal("linear"),
  raw: linearOAuthRawSchema,
  organization: z.object({
    id: z.string(),
    name: z.string().optional(),
    urlKey: z.string().optional(),
  }).optional(),
});

export type LinearAccountInfo = z.infer<typeof linearAccountInfoSchema>;

// ── Config Schema ──

export const linearConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  webhookSigningSecret: z.string(),
  callbackBaseUrl: z.string(),
});

export type LinearConfig = z.infer<typeof linearConfigSchema>;

// ── OAuth Response Schema ──

export const linearOAuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  scope: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
});

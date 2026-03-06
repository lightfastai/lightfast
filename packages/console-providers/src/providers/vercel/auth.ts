import { z } from "zod";

// ── Raw OAuth Response Shape ──

/** Raw shape from Vercel POST /v2/oauth/access_token (minus access_token secret) */
export const vercelOAuthRawSchema = z.object({
  token_type: z.string(),
  installation_id: z.string(),
  user_id: z.string(),
  team_id: z.string().nullable(),
});

export type VercelOAuthRaw = z.infer<typeof vercelOAuthRawSchema>;

// ── Account Info Schema ──

export const vercelAccountInfoSchema = z.object({
  version: z.literal(1),
  events: z.array(z.string()),
  installedAt: z.string(),
  lastValidatedAt: z.string(),
  sourceType: z.literal("vercel"),
  raw: vercelOAuthRawSchema,
});

export type VercelAccountInfo = z.infer<typeof vercelAccountInfoSchema>;

// ── Config Schema ──

export const vercelConfigSchema = z.object({
  integrationSlug: z.string(),
  clientSecretId: z.string(),
  clientIntegrationSecret: z.string(),
  callbackBaseUrl: z.string(),
});

export type VercelConfig = z.infer<typeof vercelConfigSchema>;

// ── OAuth Response Schema ──

export const vercelOAuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  installation_id: z.string(),
  user_id: z.string(),
  team_id: z.string().nullable(),
});

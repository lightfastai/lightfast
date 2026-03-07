import { z } from "zod";
import { syncSchema } from "../../sync.js";

// ── Raw OAuth Response Shape ──

/**
 * Convention: raw = non-secret fields from the token exchange response.
 * Display data (team slug, username) is resolved live in
 * connections.vercel.list via GET /v2/teams/{id} or GET /v2/user.
 */
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

// ── Provider Config Schema ──

/** @see githubProviderConfigSchema for design invariants */
export const vercelProviderConfigSchema = z.object({
  version: z.literal(1),
  sourceType: z.literal("vercel"),
  type: z.literal("project"),
  projectId: z.string(),
  teamId: z.string().optional(),
  configurationId: z.string(),
  sync: syncSchema.omit({ branches: true, paths: true }),
});

export type VercelProviderConfig = z.infer<typeof vercelProviderConfigSchema>;

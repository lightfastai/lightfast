/** Per-provider config schemas — stored as JSONB in workspace_integrations.provider_config */

import { z } from "zod";

const syncSchema = z.object({
  branches: z.array(z.string()).optional(),
  paths: z.array(z.string()).optional(),
  events: z.array(z.string()).optional(),
  autoSync: z.boolean(),
});

export const githubProviderConfigSchema = z.object({
  version: z.literal(1),
  sourceType: z.literal("github"),
  type: z.literal("repository"),
  installationId: z.string(),
  repoId: z.string(),
  sync: syncSchema,
  status: z
    .object({
      configStatus: z.enum(["configured", "awaiting_config"]).optional(),
      configPath: z.string().optional(),
      lastConfigCheck: z.string().optional(),
    })
    .optional(),
});

export type GithubProviderConfig = z.infer<typeof githubProviderConfigSchema>;

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

export const sentryProviderConfigSchema = z.object({
  version: z.literal(1),
  sourceType: z.literal("sentry"),
  type: z.literal("project"),
  projectId: z.string(),
  sync: syncSchema.omit({ branches: true, paths: true }),
});

export type SentryProviderConfig = z.infer<typeof sentryProviderConfigSchema>;

export const linearProviderConfigSchema = z.object({
  version: z.literal(1),
  sourceType: z.literal("linear"),
  type: z.literal("team"),
  teamId: z.string(),
  sync: syncSchema.omit({ branches: true, paths: true }),
});

export type LinearProviderConfig = z.infer<typeof linearProviderConfigSchema>;

/** Discriminated union of all provider configs */
export const providerConfigSchema = z.discriminatedUnion("sourceType", [
  githubProviderConfigSchema,
  vercelProviderConfigSchema,
  sentryProviderConfigSchema,
  linearProviderConfigSchema,
]);

export type ProviderConfig = z.infer<typeof providerConfigSchema>;

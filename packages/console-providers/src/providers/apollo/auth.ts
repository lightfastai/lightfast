import { z } from "zod";
import { syncSchema } from "../../provider/primitives";

// ── Config Schema ──

/**
 * Apollo has no server-side secrets — the API key is stored per-installation
 * in the token vault (as accessToken). Config is an empty object.
 */
export const apolloConfigSchema = z.object({});

export type ApolloConfig = z.infer<typeof apolloConfigSchema>;

// ── Account Info Schema ──

export const apolloAccountInfoSchema = z.object({
  version: z.literal(1),
  sourceType: z.literal("apollo"),
  events: z.array(z.string()),
  installedAt: z.string(),
  lastValidatedAt: z.string(),
  raw: z.record(z.string(), z.unknown()),
});

export type ApolloAccountInfo = z.infer<typeof apolloAccountInfoSchema>;

// ── Provider Config Schema ──

export const apolloProviderConfigSchema = z.object({
  provider: z.literal("apollo"),
  type: z.literal("workspace"),
  sync: syncSchema.optional(),
});

export type ApolloProviderConfig = z.infer<typeof apolloProviderConfigSchema>;

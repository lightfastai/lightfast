import { z } from "zod";

export const transformContextSchema = z.object({
  deliveryId: z.string(),
  receivedAt: z.number(),
});

export type TransformContext = z.infer<typeof transformContextSchema>;

// ── Sync Settings ──

/**
 * Shared sync settings schema for provider configs.
 * Used by all providers' providerConfigSchema definitions.
 */
export const syncSchema = z.object({
  events: z.array(z.string()).optional(),
  autoSync: z.boolean(),
});

// ── OAuth Types ──

export const oAuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number().optional(),
  scope: z.string().optional(),
  tokenType: z.string().optional(),
  raw: z.record(z.string(), z.unknown()),
});

export type OAuthTokens = z.infer<typeof oAuthTokensSchema>;

// ── Provider Account Info Base Schema ──

export const baseProviderAccountInfoSchema = z.object({
  version: z.literal(1),
  sourceType: z.string(),
  events: z.array(z.string()),
  installedAt: z.string(),
  lastValidatedAt: z.string(),
  raw: z.unknown(),
});

/** Structural base type — used as a type constraint in define.ts.
 * The concrete discriminated union is `ProviderAccountInfo` exported from registry.ts. */
export type BaseProviderAccountInfo = z.infer<
  typeof baseProviderAccountInfoSchema
>;

// ── Callback Result Schema ──

export const callbackResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("connected"),
    externalId: z.string(),
    accountInfo: baseProviderAccountInfoSchema.loose(),
    tokens: oAuthTokensSchema,
  }),
  z.object({
    status: z.literal("connected-no-token"),
    externalId: z.string(),
    accountInfo: baseProviderAccountInfoSchema.loose(),
  }),
  z.object({
    status: z.literal("connected-redirect"),
    externalId: z.string(),
    accountInfo: baseProviderAccountInfoSchema.loose(),
    tokens: oAuthTokensSchema,
    nextUrl: z.string(),
  }),
  z.object({
    status: z.literal("pending-setup"),
    externalId: z.string(),
    setupAction: z.string(),
  }),
]);

// ── Generic CallbackResult for compile-time narrowing ──

export type CallbackResult<
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> =
  z.infer<typeof callbackResultSchema> extends infer U
    ? U extends { accountInfo: BaseProviderAccountInfo }
      ? Omit<U, "accountInfo"> & { accountInfo: TAccountInfo }
      : U
    : never;

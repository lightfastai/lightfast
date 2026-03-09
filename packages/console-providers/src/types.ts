import { z } from "zod";

export interface TransformContext {
  deliveryId: string;
  eventType: string;
  receivedAt: Date;
}

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

const callbackAccountInfoSchema = z
  .object({
    version: z.literal(1),
    sourceType: z.string(),
    events: z.array(z.string()),
    installedAt: z.string(),
    lastValidatedAt: z.string(),
    raw: z.unknown(),
  })
  .passthrough();

export const callbackResultSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("connected"),
    externalId: z.string(),
    accountInfo: callbackAccountInfoSchema,
    tokens: oAuthTokensSchema,
  }),
  z.object({
    status: z.literal("connected-no-token"),
    externalId: z.string(),
    accountInfo: callbackAccountInfoSchema,
  }),
  z.object({
    status: z.literal("connected-redirect"),
    externalId: z.string(),
    accountInfo: callbackAccountInfoSchema,
    tokens: oAuthTokensSchema,
    nextUrl: z.string(),
  }),
  z.object({
    status: z.literal("pending-setup"),
    externalId: z.string(),
    setupAction: z.string(),
  }),
]);

/** Structural base type — used as a type constraint in define.ts.
 * The concrete discriminated union is `ProviderAccountInfo` exported from registry.ts. */
export interface BaseProviderAccountInfo {
  events: string[];
  installedAt: string;
  lastValidatedAt: string;
  raw: unknown;
  sourceType: string;
  version: 1;
}

// ── Generic CallbackResult for compile-time narrowing ──

export type CallbackResult<
  TAccountInfo extends BaseProviderAccountInfo = BaseProviderAccountInfo,
> =
  | {
      status: "connected";
      externalId: string;
      accountInfo: TAccountInfo;
      tokens: OAuthTokens;
    }
  | {
      status: "connected-no-token";
      externalId: string;
      accountInfo: TAccountInfo;
    }
  | {
      status: "connected-redirect";
      externalId: string;
      accountInfo: TAccountInfo;
      tokens: OAuthTokens;
      nextUrl: string;
    }
  | { status: "pending-setup"; externalId: string; setupAction: string };

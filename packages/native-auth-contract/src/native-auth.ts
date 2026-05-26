import { z } from "zod";

export const NATIVE_AUTH_SCHEMA_VERSION = 2;
export const NATIVE_OAUTH_CALLBACK_PATH = "/callback";
export const NATIVE_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;
export const NATIVE_OAUTH_REQUIRED_ACCESS_SCOPES = [
  "openid",
  "profile",
  "email",
] as const;

export const NATIVE_AUTH_HEADERS = {
  client: "x-lightfast-native-client",
  organizationId: "x-lightfast-organization-id",
} as const;

export const nativeClientSchema = z.enum(["cli", "desktop"]);
export type NativeClient = z.infer<typeof nativeClientSchema>;

export const nativeOAuthConfigSchema = z.object({
  authorizationEndpoint: z.string().url(),
  client: nativeClientSchema,
  clientId: z.string().min(1),
  issuer: z.string().url(),
  scopes: z.array(z.string().min(1)).min(1),
  supportsDynamicLoopbackPort: z.literal(true),
  tokenEndpoint: z.string().url(),
});

export const nativeOrganizationSchema = z.object({
  bindingStatus: z.enum(["bound", "unbound"]),
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  slug: z.string().min(1).nullable(),
});

export const nativeUserSchema = z.object({
  email: z.string().email().nullable(),
  id: z.string().min(1),
});

export const nativeSessionMetadataSchema = z.object({
  client: nativeClientSchema,
  organization: nativeOrganizationSchema.pick({
    id: true,
    name: true,
    slug: true,
  }),
  user: nativeUserSchema,
});

export const nativeFinalizeRequestSchema = z.object({
  attemptId: z.string().min(16),
  client: nativeClientSchema,
  state: z.string().min(16).max(2048),
});

export const nativeCreateAttemptInputSchema = z.object({
  client: nativeClientSchema,
  codeChallenge: z.string().min(43).max(128),
  codeChallengeMethod: z.literal("S256"),
  organizationId: z.string().min(1),
  redirectUri: z.string().url(),
  stateNonce: z.string().min(16).max(256),
});

export const oauthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().min(1).optional(),
  token_type: z
    .union([z.literal("Bearer"), z.literal("bearer")])
    .transform(() => "Bearer" as const),
});

export const tokenSetSchema = z.object({
  accessToken: z.string().min(1),
  expiresAt: z.number().int().positive(),
  refreshToken: z.string().min(1),
  tokenType: z.literal("Bearer"),
});

export const nativeSessionSchema = z.object({
  appUrl: z.string().url(),
  client: nativeClientSchema,
  oauth: z.object({
    clientId: z.string().min(1),
    issuer: z.string().url(),
  }),
  organization: nativeSessionMetadataSchema.shape.organization,
  schemaVersion: z.literal(NATIVE_AUTH_SCHEMA_VERSION),
  tokens: tokenSetSchema,
  user: nativeUserSchema,
});

export type NativeOAuthConfig = z.infer<typeof nativeOAuthConfigSchema>;
export type NativeOrganization = z.infer<typeof nativeOrganizationSchema>;
export type NativeSessionMetadata = z.infer<
  typeof nativeSessionMetadataSchema
>;
export type NativeSession = z.infer<typeof nativeSessionSchema>;
export type NativeCreateAttemptInput = z.infer<
  typeof nativeCreateAttemptInputSchema
>;
export type OAuthTokenResponse = z.infer<typeof oauthTokenResponseSchema>;
export type TokenSet = z.infer<typeof tokenSetSchema>;

export function hasRequiredNativeOAuthScopes(
  scopes: readonly string[]
): boolean {
  return NATIVE_OAUTH_REQUIRED_ACCESS_SCOPES.every((scope) =>
    scopes.includes(scope)
  );
}

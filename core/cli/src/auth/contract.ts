// SPDX-License-Identifier: Apache-2.0
// Relocated into the CLI; see ../../NOTICE and ../../LICENSE-APACHE-2.0.

import { z } from "zod";

export const NATIVE_AUTH_SCHEMA_VERSION = 2;
export const NATIVE_OAUTH_CALLBACK_PATH = "/callback";
export const NATIVE_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;
const NATIVE_OAUTH_REQUIRED_ACCESS_SCOPES = [
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

const nativeOrganizationSchema = z.object({
  bindingStatus: z.enum(["bound", "unbound"]),
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  slug: z.string().min(1).nullable(),
});

const nativeUserSchema = z.object({
  email: z.string().email().nullable(),
  id: z.string().min(1),
  imageUrl: z.string().min(1).nullable().optional(),
  initials: z.string().min(1).max(2).nullable().optional(),
  username: z.string().min(1).nullable().optional(),
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

export const oauthTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
  refresh_token: z.string().min(1).optional(),
  token_type: z
    .union([z.literal("Bearer"), z.literal("bearer")])
    .transform(() => "Bearer" as const),
});

const tokenSetSchema = z.object({
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
export type NativeSessionMetadata = z.infer<typeof nativeSessionMetadataSchema>;
export type NativeSession = z.infer<typeof nativeSessionSchema>;
export type TokenSet = z.infer<typeof tokenSetSchema>;

export function hasRequiredNativeOAuthScopes(
  scopes: readonly string[]
): boolean {
  return NATIVE_OAUTH_REQUIRED_ACCESS_SCOPES.every((scope) =>
    scopes.includes(scope)
  );
}

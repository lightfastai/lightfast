import { describe, expect, it } from "vitest";

import {
  NATIVE_AUTH_HEADERS,
  NATIVE_AUTH_SCHEMA_VERSION,
  NATIVE_OAUTH_SCOPES,
  hasRequiredNativeOAuthScopes,
  nativeClientSchema,
  nativeOAuthConfigSchema,
  nativeSessionSchema,
  nativeSessionMetadataSchema,
  oauthTokenResponseSchema,
} from "../native-auth";

describe("@repo/native-auth-contract native auth", () => {
  it("defines stable native OAuth constants", () => {
    expect(NATIVE_AUTH_SCHEMA_VERSION).toBe(2);
    expect(NATIVE_OAUTH_SCOPES).toEqual([
      "openid",
      "profile",
      "email",
      "offline_access",
    ]);
    expect(NATIVE_AUTH_HEADERS).toEqual({
      client: "x-lightfast-native-client",
      organizationId: "x-lightfast-organization-id",
    });
  });

  it("accepts only known native clients", () => {
    expect(nativeClientSchema.parse("cli")).toBe("cli");
    expect(nativeClientSchema.parse("desktop")).toBe("desktop");
    expect(() => nativeClientSchema.parse("web")).toThrow();
  });

  it("validates app-provided OAuth config for both native clients", () => {
    expect(
      nativeOAuthConfigSchema.parse({
        authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
        client: "cli",
        clientId: "cli_client_test",
        issuer: "https://clerk.example.com",
        scopes: ["openid", "profile", "email", "offline_access"],
        supportsDynamicLoopbackPort: true,
        tokenEndpoint: "https://clerk.example.com/oauth/token",
      })
    ).toMatchObject({ client: "cli", clientId: "cli_client_test" });
    expect(
      nativeOAuthConfigSchema.parse({
        authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
        client: "desktop",
        clientId: "desktop_client_test",
        issuer: "https://clerk.example.com",
        scopes: ["openid", "profile", "email", "offline_access"],
        supportsDynamicLoopbackPort: true,
        tokenEndpoint: "https://clerk.example.com/oauth/token",
      })
    ).toMatchObject({
      client: "desktop",
      clientId: "desktop_client_test",
    });
  });

  it("checks required OAuth scopes", () => {
    expect(hasRequiredNativeOAuthScopes(["openid", "profile", "email"])).toBe(
      true
    );
    expect(hasRequiredNativeOAuthScopes(["openid", "email"])).toBe(false);
  });

  it("normalizes OAuth token type casing", () => {
    expect(
      oauthTokenResponseSchema.parse({
        access_token: "access",
        expires_in: 3600,
        refresh_token: "refresh",
        token_type: "bearer",
      })
    ).toMatchObject({ token_type: "Bearer" });
  });

  it("validates native session metadata", () => {
    expect(
      nativeSessionMetadataSchema.parse({
        client: "cli",
        organization: {
          id: "org_1",
          name: "Acme",
          slug: "acme",
        },
        user: { email: "dev@example.com", id: "user_1" },
      })
    ).toMatchObject({
      client: "cli",
      organization: { id: "org_1" },
      user: { id: "user_1" },
    });
  });

  it("validates org-bound native session shape", () => {
    expect(
      nativeSessionSchema.parse({
        appUrl: "https://app.lightfast.test",
        client: "cli",
        oauth: {
          clientId: "cli_client_test",
          issuer: "https://clerk.example.com",
        },
        organization: { id: "org_1", name: "Acme", slug: "acme" },
        schemaVersion: 2,
        tokens: {
          accessToken: "access",
          expiresAt: 4_102_444_800_000,
          refreshToken: "refresh",
          tokenType: "Bearer",
        },
        user: { email: "dev@example.com", id: "user_1" },
      })
    ).toMatchObject({
      client: "cli",
      organization: { id: "org_1" },
      schemaVersion: 2,
    });
  });

  it("rejects pre-migration CLI sessions without an organization binding", () => {
    expect(() =>
      nativeSessionSchema.parse({
        appUrl: "https://app.lightfast.test",
        oauth: {
          clientId: "cli_client_test",
          issuer: "https://clerk.example.com",
        },
        org: null,
        schemaVersion: 1,
        tokens: {
          accessToken: "access",
          expiresAt: 4_102_444_800_000,
          refreshToken: "refresh",
          tokenType: "Bearer",
        },
        user: { email: "dev@example.com", id: "user_1" },
      })
    ).toThrow();
  });
});

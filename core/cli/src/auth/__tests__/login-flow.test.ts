import { NATIVE_AUTH_SCHEMA_VERSION } from "@repo/native-auth-contract";
import { describe, expect, it, vi } from "vitest";

import { login } from "../login-flow";

describe("CLI native auth login flow", () => {
  it("opens app OAuth start, exchanges code, finalizes metadata, and persists org-bound auth.json", async () => {
    const getOAuthConfig = vi.fn(async () => ({
      authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
      client: "cli" as const,
      clientId: "cli_client_test",
      issuer: "https://clerk.example.com",
      scopes: ["openid", "profile", "email", "offline_access"],
      supportsDynamicLoopbackPort: true as const,
      tokenEndpoint: "https://clerk.example.com/oauth/token",
    }));
    const finalizeNativeAuth = vi.fn(async () => ({
      client: "cli" as const,
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: { email: "dev@example.com", id: "user_1" },
    }));
    const close = vi.fn(async () => undefined);
    const store = { clear: vi.fn(), get: vi.fn(), set: vi.fn() };
    const openBrowser = vi.fn();
    const exchangeAuthorizationCode = vi.fn(async () => ({
      accessToken: "access",
      expiresAt: 4_102_444_800_000,
      refreshToken: "refresh",
      tokenType: "Bearer" as const,
    }));
    const state = Buffer.from(
      JSON.stringify({
        attemptId: "attempt_123456789",
        nonce: "nonce_1234567890",
      }),
      "utf8"
    ).toString("base64url");

    await expect(
      login({
        deps: {
          buildCodeChallenge: () => "challenge",
          createAppClient: () => ({ finalizeNativeAuth, getOAuthConfig }),
          createCodeVerifier: () => "verifier",
          createStateNonce: () => "nonce_1234567890",
          exchangeAuthorizationCode,
          getAppUrl: () => "https://app.lightfast.test",
          openBrowser,
          startLoopbackServer: vi.fn(async () => ({
            close,
            port: 54_321,
            waitForCallback: vi.fn(async () => ({
              code: "callback-code",
              state,
            })),
          })),
          store,
        },
      })
    ).resolves.toMatchObject({
      appUrl: "https://app.lightfast.test",
      client: "cli",
      oauth: {
        clientId: "cli_client_test",
        issuer: "https://clerk.example.com",
      },
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      schemaVersion: NATIVE_AUTH_SCHEMA_VERSION,
      user: { id: "user_1" },
    });

    const startUrl = new URL(String(openBrowser.mock.calls[0]?.[0]));
    expect(startUrl.pathname).toBe("/oauth/cli/start");
    expect(startUrl.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:54321/callback"
    );
    expect(startUrl.searchParams.get("state")).toBe("nonce_1234567890");
    expect(startUrl.searchParams.get("code_challenge")).toBe("challenge");
    expect(startUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(exchangeAuthorizationCode).toHaveBeenCalledWith({
      code: "callback-code",
      codeVerifier: "verifier",
      config: expect.objectContaining({ clientId: "cli_client_test" }),
      redirectUri: "http://127.0.0.1:54321/callback",
    });
    expect(finalizeNativeAuth).toHaveBeenCalledWith({
      accessToken: "access",
      attemptId: "attempt_123456789",
      state,
    });
    expect(store.set).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: expect.objectContaining({ id: "org_1" }),
        tokens: expect.objectContaining({ accessToken: "access" }),
      })
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns the persisted session when loopback cleanup fails after a successful login", async () => {
    const getOAuthConfig = vi.fn(async () => ({
      authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
      client: "cli" as const,
      clientId: "cli_client_test",
      issuer: "https://clerk.example.com",
      scopes: ["openid", "profile", "email", "offline_access"],
      supportsDynamicLoopbackPort: true as const,
      tokenEndpoint: "https://clerk.example.com/oauth/token",
    }));
    const finalizeNativeAuth = vi.fn(async () => ({
      client: "cli" as const,
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: { email: "dev@example.com", id: "user_1" },
    }));
    const close = vi.fn(async () => {
      throw new Error("close failed");
    });
    const store = { clear: vi.fn(), get: vi.fn(), set: vi.fn() };
    const exchangeAuthorizationCode = vi.fn(async () => ({
      accessToken: "access",
      expiresAt: 4_102_444_800_000,
      refreshToken: "refresh",
      tokenType: "Bearer" as const,
    }));
    const state = Buffer.from(
      JSON.stringify({
        attemptId: "attempt_123456789",
        nonce: "nonce_1234567890",
      }),
      "utf8"
    ).toString("base64url");

    await expect(
      login({
        deps: {
          buildCodeChallenge: () => "challenge",
          createAppClient: () => ({ finalizeNativeAuth, getOAuthConfig }),
          createCodeVerifier: () => "verifier",
          createStateNonce: () => "nonce_1234567890",
          exchangeAuthorizationCode,
          getAppUrl: () => "https://app.lightfast.test",
          openBrowser: vi.fn(),
          startLoopbackServer: vi.fn(async () => ({
            close,
            port: 54_321,
            waitForCallback: vi.fn(async () => ({
              code: "callback-code",
              state,
            })),
          })),
          store,
        },
      })
    ).resolves.toMatchObject({
      appUrl: "https://app.lightfast.test",
      client: "cli",
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      schemaVersion: NATIVE_AUTH_SCHEMA_VERSION,
      user: { id: "user_1" },
    });

    expect(store.set).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("rejects callbacks whose state envelope nonce does not match", async () => {
    const state = Buffer.from(
      JSON.stringify({
        attemptId: "attempt_123456789",
        nonce: "other_nonce_12345",
      }),
      "utf8"
    ).toString("base64url");

    await expect(
      login({
        deps: {
          buildCodeChallenge: () => "challenge",
          createAppClient: () => ({
            finalizeNativeAuth: vi.fn(),
            getOAuthConfig: vi.fn(async () => ({
              authorizationEndpoint:
                "https://clerk.example.com/oauth/authorize",
              client: "cli" as const,
              clientId: "cli_client_test",
              issuer: "https://clerk.example.com",
              scopes: ["openid", "profile", "email", "offline_access"],
              supportsDynamicLoopbackPort: true as const,
              tokenEndpoint: "https://clerk.example.com/oauth/token",
            })),
          }),
          createCodeVerifier: () => "verifier",
          createStateNonce: () => "nonce_1234567890",
          getAppUrl: () => "https://app.lightfast.test",
          openBrowser: vi.fn(),
          startLoopbackServer: vi.fn(async () => ({
            close: vi.fn(async () => undefined),
            port: 54_321,
            waitForCallback: vi.fn(async () => ({
              code: "callback-code",
              state,
            })),
          })),
          store: { clear: vi.fn(), get: vi.fn(), set: vi.fn() },
        },
      })
    ).rejects.toMatchObject({ code: "OAUTH_STATE_MISMATCH" });
  });

  it("preserves the primary login error when loopback cleanup fails", async () => {
    const close = vi.fn(async () => {
      throw new Error("close failed");
    });
    const state = Buffer.from(
      JSON.stringify({
        attemptId: "attempt_123456789",
        nonce: "other_nonce_12345",
      }),
      "utf8"
    ).toString("base64url");

    await expect(
      login({
        deps: {
          buildCodeChallenge: () => "challenge",
          createAppClient: () => ({
            finalizeNativeAuth: vi.fn(),
            getOAuthConfig: vi.fn(async () => ({
              authorizationEndpoint:
                "https://clerk.example.com/oauth/authorize",
              client: "cli" as const,
              clientId: "cli_client_test",
              issuer: "https://clerk.example.com",
              scopes: ["openid", "profile", "email", "offline_access"],
              supportsDynamicLoopbackPort: true as const,
              tokenEndpoint: "https://clerk.example.com/oauth/token",
            })),
          }),
          createCodeVerifier: () => "verifier",
          createStateNonce: () => "nonce_1234567890",
          getAppUrl: () => "https://app.lightfast.test",
          openBrowser: vi.fn(),
          startLoopbackServer: vi.fn(async () => ({
            close,
            port: 54_321,
            waitForCallback: vi.fn(async () => ({
              code: "callback-code",
              state,
            })),
          })),
          store: { clear: vi.fn(), get: vi.fn(), set: vi.fn() },
        },
      })
    ).rejects.toMatchObject({ code: "OAUTH_STATE_MISMATCH" });

    expect(close).toHaveBeenCalledOnce();
  });
});

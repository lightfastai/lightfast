import type { NativeOAuthConfig } from "@repo/native-auth-contract";
import { describe, expect, it, vi } from "vitest";

import {
  exchangeAuthorizationCode,
  refreshAccessToken,
} from "../auth/token-client";

const config = {
  authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
  client: "cli",
  clientId: "cli_client_test",
  issuer: "https://clerk.example.com",
  scopes: ["openid", "profile", "email", "offline_access"],
  supportsDynamicLoopbackPort: true,
  tokenEndpoint: "https://clerk.example.com/oauth/token",
} satisfies NativeOAuthConfig;

describe("OAuth token client", () => {
  it("exchanges an authorization code without a client secret", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json({
        access_token: "access",
        expires_in: 3600,
        refresh_token: "refresh",
        token_type: "bearer",
      })
    );

    await expect(
      exchangeAuthorizationCode({
        code: "code",
        codeVerifier: "verifier",
        config,
        fetchImpl: fetchMock,
        now: () => 1000,
        redirectUri: "http://127.0.0.1:51010/callback",
      })
    ).resolves.toEqual({
      accessToken: "access",
      expiresAt: 3_601_000,
      refreshToken: "refresh",
      tokenType: "Bearer",
    });

    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(config.tokenEndpoint);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe("cli_client_test");
    expect(body.get("code")).toBe("code");
    expect(body.get("code_verifier")).toBe("verifier");
    expect(body.has("client_secret")).toBe(false);
  });

  it("refreshes access tokens and preserves the previous refresh token when omitted", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json({
        access_token: "new-access",
        expires_in: 60,
        token_type: "bearer",
      })
    );

    await expect(
      refreshAccessToken({
        config,
        fetchImpl: fetchMock,
        now: () => 1000,
        refreshToken: "old-refresh",
      })
    ).resolves.toEqual({
      accessToken: "new-access",
      expiresAt: 61_000,
      refreshToken: "old-refresh",
      tokenType: "Bearer",
    });

    const body = fetchMock.mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("client_id")).toBe("cli_client_test");
    expect(body.get("refresh_token")).toBe("old-refresh");
    expect(body.has("client_secret")).toBe(false);
  });

  it("requires authorization-code exchanges to return a refresh token", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json({
        access_token: "access",
        expires_in: 3600,
        token_type: "Bearer",
      })
    );

    await expect(
      exchangeAuthorizationCode({
        code: "code",
        codeVerifier: "verifier",
        config,
        fetchImpl: fetchMock,
        redirectUri: "http://127.0.0.1:51010/callback",
      })
    ).rejects.toMatchObject({ code: "TOKEN_RESPONSE_INVALID" });
  });
});

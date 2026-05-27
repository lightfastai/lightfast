import type { NativeOAuthConfig } from "@repo/native-auth-contract";
import { describe, expect, it, vi } from "vitest";

import { exchangeAuthorizationCode, refreshAccessToken } from "..";

const config: NativeOAuthConfig = {
  authorizationEndpoint: "https://clerk.test/oauth/authorize",
  client: "cli",
  clientId: "client_123",
  issuer: "https://clerk.test",
  scopes: ["openid", "profile", "email", "offline_access"],
  supportsDynamicLoopbackPort: true,
  tokenEndpoint: "https://clerk.test/oauth/token",
};

describe("@repo/native-auth-node token client", () => {
  it("exchanges authorization codes with PKCE", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        access_token: "access",
        expires_in: 3600,
        refresh_token: "refresh",
        token_type: "Bearer",
      })
    );

    const tokens = await exchangeAuthorizationCode({
      code: "code_123",
      codeVerifier: "verifier_123",
      config,
      fetchImpl,
      now: () => 1000,
      redirectUri: "http://127.0.0.1:51010/callback",
    });

    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    const body = calls[0]?.[1].body as URLSearchParams;
    expect(fetchImpl).toHaveBeenCalledWith(
      config.tokenEndpoint,
      expect.objectContaining({ method: "POST" })
    );
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe("client_123");
    expect(body.get("code_verifier")).toBe("verifier_123");
    expect(tokens).toEqual({
      accessToken: "access",
      expiresAt: 3_601_000,
      refreshToken: "refresh",
      tokenType: "Bearer",
    });
  });

  it("refreshes access tokens and preserves refresh token when omitted", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        access_token: "new_access",
        expires_in: 60,
        token_type: "bearer",
      })
    );

    await expect(
      refreshAccessToken({
        config,
        fetchImpl,
        now: () => 2000,
        refreshToken: "old_refresh",
      })
    ).resolves.toEqual({
      accessToken: "new_access",
      expiresAt: 62_000,
      refreshToken: "old_refresh",
      tokenType: "Bearer",
    });
  });
});

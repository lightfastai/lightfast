import { describe, expect, it, vi } from "vitest";

import {
  buildLinearOAuthAuthorizeUrl,
  exchangeLinearOAuthCode,
  refreshLinearOAuthToken,
  revokeLinearOAuthToken,
} from "../oauth";

describe("buildLinearOAuthAuthorizeUrl", () => {
  it("builds an app-actor OAuth authorize URL with comma-delimited scopes and PKCE", () => {
    const url = new URL(
      buildLinearOAuthAuthorizeUrl({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/linear/callback",
        clientId: "lin_client_123",
        codeChallenge: "challenge_123",
        oauthAuthorizeUrl: "https://linear.test/oauth/authorize",
        state: "state_123",
      })
    );

    expect(url.origin + url.pathname).toBe(
      "https://linear.test/oauth/authorize"
    );
    expect(url.searchParams.get("actor")).toBe("app");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("read,write");
    expect(url.searchParams.get("state")).toBe("state_123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge_123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.lightfast.localhost/api/connectors/linear/callback"
    );
  });

  it("rejects direct custom authorize endpoints outside development and test", () => {
    expect(() =>
      buildLinearOAuthAuthorizeUrl({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/linear/callback",
        clientId: "lin_client_123",
        codeChallenge: "challenge_123",
        nodeEnv: "production",
        oauthAuthorizeUrl: "https://linear.test/oauth/authorize",
        state: "state_123",
      })
    ).toThrow(
      expect.objectContaining({ code: "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN" })
    );
  });
});

describe("exchangeLinearOAuthCode", () => {
  it("parses access token, optional refresh token, expiry fields, and exact scopes", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        access_token: "lin_access",
        expires_in: 3600,
        refresh_token: "lin_refresh",
        refresh_token_expires_in: 2_592_000,
        scope: "read,write admin",
        token_type: "Bearer",
      })
    );

    await expect(
      exchangeLinearOAuthCode({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/linear/callback",
        clientId: "lin_client_123",
        clientSecret: "secret",
        code: "code_123",
        codeVerifier: "verifier_123",
        fetch: fetchMock,
        tokenUrl: "https://api.linear.test/oauth/token",
      })
    ).resolves.toEqual({
      accessToken: "lin_access",
      accessTokenExpiresIn: 3600,
      refreshToken: "lin_refresh",
      refreshTokenExpiresIn: 2_592_000,
      scope: "read,write admin",
      scopes: ["read", "write", "admin"],
      tokenType: "Bearer",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.linear.test/oauth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded",
        }),
      })
    );
    const body = new URLSearchParams(
      String(fetchMock.mock.calls[0]?.[1]?.body)
    );
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe("lin_client_123");
    expect(body.get("client_secret")).toBe("secret");
    expect(body.get("code")).toBe("code_123");
    expect(body.get("code_verifier")).toBe("verifier_123");
    expect(body.get("redirect_uri")).toBe(
      "https://app.lightfast.localhost/api/connectors/linear/callback"
    );
  });

  it("sanitizes transport failures without exposing OAuth secrets", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new Error("network failed with secret lin_secret_123");
    });

    await expect(
      exchangeLinearOAuthCode({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/linear/callback",
        clientId: "lin_client_123",
        clientSecret: "lin_secret_123",
        code: "code_123",
        codeVerifier: "verifier_123",
        fetch: fetchMock,
      })
    ).rejects.toMatchObject({
      cause: { name: "Error" },
      code: "LINEAR_OAUTH_EXCHANGE_FAILED",
      message: "Linear OAuth code exchange failed.",
    });

    try {
      await exchangeLinearOAuthCode({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/linear/callback",
        clientId: "lin_client_123",
        clientSecret: "lin_secret_123",
        code: "code_123",
        codeVerifier: "verifier_123",
        fetch: fetchMock,
      });
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain("lin_secret_123");
      expect(String(error)).not.toContain("lin_secret_123");
    }
  });

  it("rejects direct custom token endpoints outside development and test", async () => {
    await expect(
      exchangeLinearOAuthCode({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/linear/callback",
        clientId: "lin_client_123",
        clientSecret: "secret",
        code: "code_123",
        codeVerifier: "verifier_123",
        nodeEnv: "production",
        tokenUrl: "https://api.linear.test/oauth/token",
      })
    ).rejects.toMatchObject({ code: "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN" });
  });
});

describe("refreshLinearOAuthToken", () => {
  it("keeps the old refresh token when Linear omits a replacement", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        access_token: "lin_access_refreshed",
        expires_in: 3600,
        scope: "read,write",
        token_type: "Bearer",
      })
    );

    await expect(
      refreshLinearOAuthToken({
        clientId: "lin_client_123",
        clientSecret: "secret",
        fetch: fetchMock,
        refreshToken: "existing_refresh",
        refreshTokenExpiresIn: 2_592_000,
        tokenUrl: "https://api.linear.test/oauth/token",
      })
    ).resolves.toEqual({
      accessToken: "lin_access_refreshed",
      accessTokenExpiresIn: 3600,
      refreshToken: "existing_refresh",
      refreshTokenExpiresIn: 2_592_000,
      scope: "read,write",
      scopes: ["read", "write"],
      tokenType: "Bearer",
    });

    const body = new URLSearchParams(
      String(fetchMock.mock.calls[0]?.[1]?.body)
    );
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("existing_refresh");
  });
});

describe("revokeLinearOAuthToken", () => {
  it("rejects direct custom revoke endpoints outside development and test", async () => {
    await expect(
      revokeLinearOAuthToken({
        clientId: "lin_client_123",
        clientSecret: "secret",
        nodeEnv: "production",
        revokeUrl: "https://api.linear.test/oauth/revoke",
        token: "lin_access",
      })
    ).rejects.toMatchObject({ code: "LINEAR_CUSTOM_ENDPOINT_FORBIDDEN" });
  });
});

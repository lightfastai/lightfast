import { describe, expect, it, vi } from "vitest";

import {
  buildXOAuthAuthorizeUrl,
  exchangeXOAuthCode,
  refreshXOAuthToken,
  revokeXOAuthToken,
  X_OAUTH_SCOPE,
  X_OAUTH_SCOPES,
} from "../oauth";

const expectedScopes = [
  "tweet.read",
  "users.read",
  "offline.access",
  "tweet.write",
  "tweet.moderate.write",
  "follows.read",
  "follows.write",
  "mute.read",
  "mute.write",
  "like.read",
  "like.write",
  "list.read",
  "list.write",
  "block.read",
  "block.write",
  "bookmark.read",
  "bookmark.write",
  "dm.read",
  "dm.write",
  "media.write",
];

describe("buildXOAuthAuthorizeUrl", () => {
  it("builds an OAuth2 PKCE authorize URL with social account scopes", () => {
    const url = new URL(
      buildXOAuthAuthorizeUrl({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/x/callback",
        clientId: "x_client_123",
        codeChallenge: "challenge_123",
        oauthAuthorizeUrl: "https://x.test/i/oauth2/authorize",
        state: "state_123",
      })
    );

    expect(url.origin + url.pathname).toBe("https://x.test/i/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("x_client_123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://app.lightfast.localhost/api/connectors/x/callback"
    );
    expect(X_OAUTH_SCOPES).toEqual(expectedScopes);
    expect(url.searchParams.get("scope")).toBe(expectedScopes.join(" "));
    expect(url.searchParams.get("state")).toBe("state_123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge_123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  it("rejects direct custom authorize endpoints outside development and test", () => {
    expect(() =>
      buildXOAuthAuthorizeUrl({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/x/callback",
        clientId: "x_client_123",
        codeChallenge: "challenge_123",
        nodeEnv: "production",
        oauthAuthorizeUrl: "https://x.test/i/oauth2/authorize",
        state: "state_123",
      })
    ).toThrow(expect.objectContaining({ code: "X_CUSTOM_ENDPOINT_FORBIDDEN" }));
  });
});

describe("exchangeXOAuthCode", () => {
  it("uses Basic auth and parses X token response fields", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        access_token: "x_access",
        expires_in: 7200,
        refresh_token: "x_refresh",
        scope: X_OAUTH_SCOPE,
        token_type: "bearer",
      })
    );

    await expect(
      exchangeXOAuthCode({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/x/callback",
        clientId: "x_client_123",
        clientSecret: "secret",
        code: "code_123",
        codeVerifier: "verifier_123",
        fetch: fetchMock,
        tokenUrl: "https://api.x.test/2/oauth2/token",
      })
    ).resolves.toEqual({
      accessToken: "x_access",
      accessTokenExpiresIn: 7200,
      refreshToken: "x_refresh",
      refreshTokenExpiresIn: undefined,
      scope: X_OAUTH_SCOPE,
      scopes: expectedScopes,
      tokenType: "bearer",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.test/2/oauth2/token",
      expect.objectContaining({
        headers: expect.objectContaining({
          accept: "application/json",
          authorization: `Basic ${Buffer.from("x_client_123:secret").toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        }),
        method: "POST",
      })
    );
    const body = new URLSearchParams(
      String(fetchMock.mock.calls[0]?.[1]?.body)
    );
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_id")).toBe("x_client_123");
    expect(body.get("client_secret")).toBeNull();
    expect(body.get("code")).toBe("code_123");
    expect(body.get("code_verifier")).toBe("verifier_123");
    expect(body.get("redirect_uri")).toBe(
      "https://app.lightfast.localhost/api/connectors/x/callback"
    );
  });

  it("sanitizes transport failures without exposing OAuth secrets", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      throw new Error("network failed with secret x_secret_123");
    });

    await expect(
      exchangeXOAuthCode({
        callbackUrl:
          "https://app.lightfast.localhost/api/connectors/x/callback",
        clientId: "x_client_123",
        clientSecret: "x_secret_123",
        code: "code_123",
        codeVerifier: "verifier_123",
        fetch: fetchMock,
      })
    ).rejects.toMatchObject({
      cause: { name: "Error" },
      code: "X_OAUTH_EXCHANGE_FAILED",
      message: "X OAuth code exchange failed.",
    });
  });
});

describe("refreshXOAuthToken", () => {
  it("keeps the old refresh token when X omits a replacement", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        access_token: "x_access_refreshed",
        expires_in: 7200,
        scope: X_OAUTH_SCOPE,
        token_type: "bearer",
      })
    );

    await expect(
      refreshXOAuthToken({
        clientId: "x_client_123",
        clientSecret: "secret",
        fetch: fetchMock,
        refreshToken: "existing_refresh",
        tokenUrl: "https://api.x.test/2/oauth2/token",
      })
    ).resolves.toEqual({
      accessToken: "x_access_refreshed",
      accessTokenExpiresIn: 7200,
      refreshToken: "existing_refresh",
      refreshTokenExpiresIn: undefined,
      scope: X_OAUTH_SCOPE,
      scopes: expectedScopes,
      tokenType: "bearer",
    });

    const body = new URLSearchParams(
      String(fetchMock.mock.calls[0]?.[1]?.body)
    );
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("client_id")).toBe("x_client_123");
    expect(body.get("refresh_token")).toBe("existing_refresh");
  });
});

describe("revokeXOAuthToken", () => {
  it("posts token revocation with Basic auth and client id", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null));

    await expect(
      revokeXOAuthToken({
        clientId: "x_client_123",
        clientSecret: "secret",
        fetch: fetchMock,
        revokeUrl: "https://api.x.test/2/oauth2/revoke",
        token: "x_access",
      })
    ).resolves.toBeUndefined();

    const body = new URLSearchParams(
      String(fetchMock.mock.calls[0]?.[1]?.body)
    );
    expect(body.get("client_id")).toBe("x_client_123");
    expect(body.get("token")).toBe("x_access");
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual(
      expect.objectContaining({
        authorization: `Basic ${Buffer.from("x_client_123:secret").toString("base64")}`,
      })
    );
  });
});

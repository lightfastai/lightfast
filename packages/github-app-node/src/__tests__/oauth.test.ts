import { afterEach, describe, expect, it, vi } from "vitest";
import {
  exchangeGitHubOAuthCode,
  refreshGitHubUserAccessToken,
  revokeGitHubOAuthGrant,
} from "../oauth";

describe("exchangeGitHubOAuthCode", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("posts the code exchange request and returns the user access token", async () => {
    const fetchMock = vi.fn(
      async (
        _url: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1]
      ) => Response.json({ access_token: "gho_test", token_type: "bearer" })
    );

    await expect(
      exchangeGitHubOAuthCode({
        clientId: "Iv1.lightfastlocal",
        clientSecret: "secret",
        code: "code_123",
        codeVerifier: "verifier",
        fetch: fetchMock,
        redirectUri:
          "https://app.lightfast.localhost/api/github/oauth/callback",
        tokenUrl: "http://127.0.0.1:4567/login/oauth/access_token",
      })
    ).resolves.toEqual({ accessToken: "gho_test", tokenType: "bearer" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4567/login/oauth/access_token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          accept: "application/json",
          "content-type": "application/json",
        }),
      })
    );
    const call = fetchMock.mock.calls[0];
    if (!call) {
      throw new Error("Expected token exchange fetch call.");
    }
    const [, init] = call;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      client_id: "Iv1.lightfastlocal",
      client_secret: "secret",
      code: "code_123",
      code_verifier: "verifier",
      redirect_uri: "https://app.lightfast.localhost/api/github/oauth/callback",
    });
  });

  it("throws a typed error when the exchange response is invalid", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ error: "bad_verification_code" }, { status: 400 })
    );

    await expect(
      exchangeGitHubOAuthCode({
        clientId: "Iv1.lightfastlocal",
        clientSecret: "secret",
        code: "code_123",
        codeVerifier: "verifier",
        fetch: fetchMock,
        redirectUri:
          "https://app.lightfast.localhost/api/github/oauth/callback",
      })
    ).rejects.toMatchObject({ code: "GITHUB_OAUTH_EXCHANGE_FAILED" });
  });

  it("wraps token exchange transport failures in a typed error", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });

    await expect(
      exchangeGitHubOAuthCode({
        clientId: "Iv1.lightfastlocal",
        clientSecret: "secret",
        code: "code_123",
        codeVerifier: "verifier",
        fetch: fetchMock,
        redirectUri:
          "https://app.lightfast.localhost/api/github/oauth/callback",
      })
    ).rejects.toMatchObject({ code: "GITHUB_OAUTH_EXCHANGE_FAILED" });
  });

  it("passes an external abort signal to fetch", async () => {
    const abortController = new AbortController();
    const fetchMock = vi.fn(
      async (
        _url: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1]
      ) => Response.json({ access_token: "gho_test", token_type: "bearer" })
    );

    await exchangeGitHubOAuthCode({
      clientId: "Iv1.lightfastlocal",
      clientSecret: "secret",
      code: "code_123",
      codeVerifier: "verifier",
      fetch: fetchMock,
      redirectUri: "https://app.lightfast.localhost/api/github/oauth/callback",
      signal: abortController.signal,
    });

    const call = fetchMock.mock.calls[0];
    if (!call) {
      throw new Error("Expected token exchange fetch call.");
    }
    const [, init] = call;
    expect(init?.signal).toBe(abortController.signal);
  });

  it("aborts the token exchange on timeout and wraps the failure", async () => {
    vi.useFakeTimers();
    let fetchSignal: AbortSignal | undefined;
    const fetchMock = vi.fn(
      (
        _url: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1]
      ) => {
        fetchSignal = init?.signal ?? undefined;
        if (!fetchSignal) {
          return Promise.reject(
            new Error("Expected token exchange fetch signal.")
          );
        }
        return new Promise<Response>((_resolve, reject) => {
          fetchSignal?.addEventListener(
            "abort",
            () =>
              reject(
                new DOMException("The operation was aborted.", "AbortError")
              ),
            { once: true }
          );
        });
      }
    );

    const exchangePromise = exchangeGitHubOAuthCode({
      clientId: "Iv1.lightfastlocal",
      clientSecret: "secret",
      code: "code_123",
      codeVerifier: "verifier",
      fetch: fetchMock,
      redirectUri: "https://app.lightfast.localhost/api/github/oauth/callback",
      timeoutMs: 25,
    });
    const exchangeExpectation = expect(exchangePromise).rejects.toMatchObject({
      code: "GITHUB_OAUTH_EXCHANGE_FAILED",
    });

    await vi.advanceTimersByTimeAsync(25);

    await exchangeExpectation;
    expect(fetchSignal).toBeInstanceOf(AbortSignal);
    expect(fetchSignal?.aborted).toBe(true);
  });

  it("clears the timeout after a successful exchange", async () => {
    vi.useFakeTimers();
    let fetchSignal: AbortSignal | undefined;
    const fetchMock = vi.fn(
      async (
        _url: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1]
      ) => {
        fetchSignal = init?.signal ?? undefined;
        return Response.json({
          access_token: "gho_test",
          token_type: "bearer",
        });
      }
    );

    await exchangeGitHubOAuthCode({
      clientId: "Iv1.lightfastlocal",
      clientSecret: "secret",
      code: "code_123",
      codeVerifier: "verifier",
      fetch: fetchMock,
      redirectUri: "https://app.lightfast.localhost/api/github/oauth/callback",
      timeoutMs: 1000,
    });

    expect(fetchSignal).toBeInstanceOf(AbortSignal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the timeout after a failed exchange", async () => {
    vi.useFakeTimers();
    let fetchSignal: AbortSignal | undefined;
    const fetchMock = vi.fn(
      async (
        _url: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1]
      ) => {
        fetchSignal = init?.signal ?? undefined;
        throw new TypeError("network unavailable");
      }
    );

    await expect(
      exchangeGitHubOAuthCode({
        clientId: "Iv1.lightfastlocal",
        clientSecret: "secret",
        code: "code_123",
        codeVerifier: "verifier",
        fetch: fetchMock,
        redirectUri:
          "https://app.lightfast.localhost/api/github/oauth/callback",
        timeoutMs: 1000,
      })
    ).rejects.toMatchObject({ code: "GITHUB_OAUTH_EXCHANGE_FAILED" });

    expect(fetchSignal).toBeInstanceOf(AbortSignal);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("parses refreshable GitHub App user token fields", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        access_token: "ghu_access",
        expires_in: 28_800,
        refresh_token: "ghr_refresh",
        refresh_token_expires_in: 15_768_000,
        scope: "",
        token_type: "bearer",
      })
    );

    await expect(
      exchangeGitHubOAuthCode({
        clientId: "Iv1.lightfastlocal",
        clientSecret: "secret",
        code: "code_123",
        codeVerifier: "verifier",
        fetch: fetchMock,
        redirectUri:
          "https://app.lightfast.localhost/api/github/user/oauth/callback",
      })
    ).resolves.toEqual({
      accessToken: "ghu_access",
      accessTokenExpiresIn: 28_800,
      refreshToken: "ghr_refresh",
      refreshTokenExpiresIn: 15_768_000,
      scope: "",
      tokenType: "bearer",
    });
  });

  it("refreshes GitHub App user access tokens", async () => {
    const fetchMock = vi.fn(
      async (
        _url: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1]
      ) =>
        Response.json({
          access_token: "ghu_next",
          expires_in: 28_800,
          refresh_token: "ghr_next",
          refresh_token_expires_in: 15_768_000,
          scope: "",
          token_type: "bearer",
        })
    );

    await expect(
      refreshGitHubUserAccessToken({
        clientId: "Iv1.lightfastlocal",
        clientSecret: "secret",
        fetch: fetchMock,
        refreshToken: "ghr_old",
        tokenUrl: "https://github.lightfast.localhost/login/oauth/access_token",
      })
    ).resolves.toEqual({
      accessToken: "ghu_next",
      accessTokenExpiresIn: 28_800,
      refreshToken: "ghr_next",
      refreshTokenExpiresIn: 15_768_000,
      scope: "",
      tokenType: "bearer",
    });

    const call = fetchMock.mock.calls[0];
    if (!call) {
      throw new Error("Expected token refresh fetch call.");
    }
    const [, init] = call;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      client_id: "Iv1.lightfastlocal",
      client_secret: "secret",
      grant_type: "refresh_token",
      refresh_token: "ghr_old",
    });
  });

  it("classifies invalid refresh token responses", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        error: "bad_refresh_token",
        error_description: "The refresh token passed is incorrect or expired.",
      })
    );

    await expect(
      refreshGitHubUserAccessToken({
        clientId: "Iv1.lightfastlocal",
        clientSecret: "secret",
        fetch: fetchMock,
        refreshToken: "ghr_old",
        tokenUrl: "https://github.lightfast.localhost/login/oauth/access_token",
      })
    ).rejects.toMatchObject({
      code: "GITHUB_OAUTH_REFRESH_TOKEN_INVALID",
    });
  });

  it("revokes a GitHub App OAuth grant", async () => {
    const fetchMock = vi.fn(
      async (
        _url: Parameters<typeof fetch>[0],
        _init?: Parameters<typeof fetch>[1]
      ) => new Response(null, { status: 204 })
    );

    await expect(
      revokeGitHubOAuthGrant({
        accessToken: "ghu_access",
        apiBaseUrl: "https://github.lightfast.localhost",
        apiVersion: "2026-03-10",
        clientId: "Iv1.lightfastlocal",
        clientSecret: "secret",
        fetch: fetchMock,
      })
    ).resolves.toBeUndefined();

    const call = fetchMock.mock.calls[0];
    if (!call) {
      throw new Error("Expected OAuth grant revoke fetch call.");
    }
    const [url, init] = call;
    expect(url).toBe(
      "https://github.lightfast.localhost/applications/Iv1.lightfastlocal/grant"
    );
    expect(init).toMatchObject({
      method: "DELETE",
      headers: expect.objectContaining({
        accept: "application/vnd.github+json",
        authorization: `Basic ${Buffer.from(
          "Iv1.lightfastlocal:secret"
        ).toString("base64")}`,
        "content-type": "application/json",
        "x-github-api-version": "2026-03-10",
      }),
      body: JSON.stringify({ access_token: "ghu_access" }),
    });
  });
});

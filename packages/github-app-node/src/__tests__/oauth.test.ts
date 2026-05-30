import { afterEach, describe, expect, it, vi } from "vitest";
import { exchangeGitHubOAuthCode } from "../oauth";

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
});

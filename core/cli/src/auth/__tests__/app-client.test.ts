import { describe, expect, it, vi } from "vitest";

import {
  createLightfastAppClient,
  type LightfastAppClientError,
} from "../app-client";

describe("Lightfast app auth client", () => {
  it("fetches OAuth config from the app facade", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json({
        authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
        client: "cli",
        clientId: "cli_client_test",
        issuer: "https://clerk.example.com",
        scopes: ["openid", "profile", "email", "offline_access"],
        supportsDynamicLoopbackPort: true,
        tokenEndpoint: "https://clerk.example.com/oauth/token",
      })
    );

    const client = createLightfastAppClient({
      appUrl: "https://app.lightfast.test",
      fetchImpl: fetchMock,
    });

    await expect(client.getOAuthConfig()).resolves.toMatchObject({
      client: "cli",
      clientId: "cli_client_test",
      scopes: ["openid", "profile", "email", "offline_access"],
      supportsDynamicLoopbackPort: true,
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://app.lightfast.test/api/oauth/cli/config"
    );
  });

  it("finalizes native auth with bearer access token", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json({
        client: "cli",
        organization: { id: "org_1", name: "Acme", slug: "acme" },
        user: { email: "dev@example.com", id: "user_1" },
      })
    );

    const client = createLightfastAppClient({
      appUrl: "https://app.lightfast.test/",
      fetchImpl: fetchMock,
    });

    await expect(
      client.finalizeNativeAuth({
        accessToken: "access",
        attemptId: "attempt_123456789",
        state: "state_1234567890123",
      })
    ).resolves.toMatchObject({
      organization: { id: "org_1" },
      user: { id: "user_1" },
    });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://app.lightfast.test/api/oauth/finalize"
    );
    expect(init.headers).toMatchObject({
      authorization: "Bearer access",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      attemptId: "attempt_123456789",
      client: "cli",
      state: "state_1234567890123",
    });
  });

  it("throws typed errors returned by the app facade", async () => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Lightfast native OAuth authentication required.",
          },
        },
        { status: 401 }
      )
    );

    const client = createLightfastAppClient({
      appUrl: "https://app.lightfast.test",
      fetchImpl: fetchMock,
    });

    await expect(
      client.finalizeNativeAuth({
        accessToken: "bad",
        attemptId: "attempt_123456789",
        state: "state_1234567890123",
      })
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      status: 401,
    } satisfies Partial<LightfastAppClientError>);
  });

  it.each([
    {
      code: "UNAUTHORIZED",
      message: "Lightfast native OAuth authentication required.",
      name: "expired token",
      status: 401,
    },
    {
      code: "FORBIDDEN",
      message: "Native auth organization mismatch",
      name: "wrong org",
      status: 403,
    },
    {
      code: "PRECONDITION_FAILED",
      message: "Organization selection required.",
      name: "no org",
      status: 412,
    },
  ])("surfaces $name auth-boundary failures", async (errorCase) => {
    const fetchMock = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      Response.json(
        {
          error: {
            code: errorCase.code,
            message: errorCase.message,
          },
        },
        { status: errorCase.status }
      )
    );

    const client = createLightfastAppClient({
      appUrl: "https://app.lightfast.test",
      fetchImpl: fetchMock,
    });

    await expect(
      client.finalizeNativeAuth({
        accessToken: "access",
        attemptId: "attempt_123456789",
        state: "state_1234567890123",
      })
    ).rejects.toMatchObject({
      code: errorCase.code,
      message: errorCase.message,
      status: errorCase.status,
    } satisfies Partial<LightfastAppClientError>);
  });

  it("normalizes empty error responses into typed client errors", async () => {
    const fetchMock = vi.fn(
      async (..._args: Parameters<typeof fetch>) =>
        new Response(null, { status: 502 })
    );

    const client = createLightfastAppClient({
      appUrl: "https://app.lightfast.test",
      fetchImpl: fetchMock,
    });

    await expect(client.getOAuthConfig()).rejects.toMatchObject({
      code: "HTTP_ERROR",
      status: 502,
    } satisfies Partial<LightfastAppClientError>);
  });

  it("passes an aborting timeout signal to auth requests", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_input: Parameters<typeof fetch>[0], init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );

    const client = createLightfastAppClient({
      appUrl: "https://app.lightfast.test",
      fetchImpl: fetchMock,
      requestTimeoutMs: 10,
    });

    const request = client.getOAuthConfig();
    const assertion = expect(request).rejects.toMatchObject({
      name: "AbortError",
    });
    await vi.advanceTimersByTimeAsync(10);

    await assertion;
    vi.useRealTimers();
  });
});

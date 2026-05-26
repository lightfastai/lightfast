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
      "https://app.lightfast.test/api/native-auth/cli/oauth-config"
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
      "https://app.lightfast.test/api/native-auth/finalize"
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
});

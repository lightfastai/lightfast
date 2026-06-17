import { afterEach, describe, expect, it, vi } from "vitest";

const { netFetchMock } = vi.hoisted(() => ({
  netFetchMock: vi.fn(),
}));

vi.mock("@vendor/electron/net", () => ({
  electronNetFetch: netFetchMock,
}));

vi.mock("../../app-url", () => ({
  createAppUrl: (path: string) => new URL(path, "https://lightfast.localhost"),
}));

const { createDesktopNativeAuthClient } = await import("../app-client");

afterEach(() => {
  vi.clearAllMocks();
});

describe("createDesktopNativeAuthClient", () => {
  it("uses the vendor Electron fetch wrapper by default", async () => {
    netFetchMock.mockResolvedValueOnce(
      Response.json({
        authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
        client: "desktop",
        clientId: "desktop_client_test",
        issuer: "https://clerk.example.com",
        scopes: ["openid", "profile", "email", "offline_access"],
        supportsDynamicLoopbackPort: true,
        tokenEndpoint: "https://clerk.example.com/oauth/token",
      })
    );

    const client = createDesktopNativeAuthClient();
    await client.getOAuthConfig();

    expect(netFetchMock).toHaveBeenCalledWith(
      "https://lightfast.localhost/api/oauth/desktop/config",
      { headers: { accept: "application/json" } }
    );
  });

  it("still supports injected fetch implementations for tests", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      Response.json({
        client: "desktop",
        organization: { id: "org_1", name: "Acme", slug: "acme" },
        user: { email: "dev@example.com", id: "user_1" },
      })
    );

    const client = createDesktopNativeAuthClient({ fetchImpl });
    await client.finalize({
      accessToken: "access",
      attemptId: "attempt_123",
      state: "state_123",
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(netFetchMock).not.toHaveBeenCalled();
  });

  it("fetches current desktop session metadata through desktop RPC", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      Response.json({
        ok: true,
        result: {
          client: "desktop",
          organization: { id: "org_1", name: "Acme", slug: "acme" },
          user: {
            email: "dev@example.com",
            id: "user_1",
            imageUrl: "https://img.example.com/user_1.png",
            initials: "JP",
            username: "jeevanpillay",
          },
        },
      })
    );

    const client = createDesktopNativeAuthClient({ fetchImpl });
    await expect(
      client.session({
        accessToken: "access",
        organizationId: "org_1",
      })
    ).resolves.toMatchObject({
      user: { initials: "JP", username: "jeevanpillay" },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://lightfast.localhost/api/desktop/rpc",
      {
        body: JSON.stringify({ command: "auth.session" }),
        headers: {
          accept: "application/json",
          authorization: "Bearer access",
          "content-type": "application/json",
          "x-lightfast-native-client": "desktop",
          "x-lightfast-organization-id": "org_1",
        },
        method: "POST",
      }
    );
  });

  it.each([
    {
      code: "FORBIDDEN",
      label: "missing organization",
      message: "Native session organization required",
      status: 403,
    },
    {
      code: "FORBIDDEN",
      label: "wrong organization",
      message: "User is not a member of the selected organization",
      status: 403,
    },
    {
      code: "UNAUTHORIZED",
      label: "expired token",
      message: "Lightfast native OAuth authentication required.",
      status: 401,
    },
  ])("surfaces desktop RPC session $label errors", async ({
    code,
    message,
    status,
  }) => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      Response.json(
        {
          ok: false,
          error: { code, message },
        },
        { status }
      )
    );

    const client = createDesktopNativeAuthClient({ fetchImpl });

    await expect(
      client.session({
        accessToken: "access",
        organizationId: "org_1",
      })
    ).rejects.toThrow(message);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(netFetchMock).not.toHaveBeenCalled();
  });

  it("rejects finalize responses without organization metadata", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      Response.json({
        client: "desktop",
        user: { email: "dev@example.com", id: "user_1" },
      })
    );

    const client = createDesktopNativeAuthClient({ fetchImpl });

    await expect(
      client.finalize({
        accessToken: "access",
        attemptId: "attempt_123",
        state: "state_123",
      })
    ).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(netFetchMock).not.toHaveBeenCalled();
  });

  it("surfaces organization mismatch errors from finalize", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      Response.json(
        {
          error: {
            code: "NATIVE_AUTH_ORGANIZATION_MISMATCH",
            message: "Native auth organization mismatch",
          },
        },
        { status: 403 }
      )
    );

    const client = createDesktopNativeAuthClient({ fetchImpl });

    await expect(
      client.finalize({
        accessToken: "access",
        attemptId: "attempt_123",
        state: "state_123",
      })
    ).rejects.toThrow("Native auth organization mismatch");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(netFetchMock).not.toHaveBeenCalled();
  });

  it("surfaces expired token errors from finalize", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      Response.json(
        {
          error: {
            code: "NATIVE_AUTH_TOKEN_EXPIRED",
            message: "Native auth token expired",
          },
        },
        { status: 401 }
      )
    );

    const client = createDesktopNativeAuthClient({ fetchImpl });

    await expect(
      client.finalize({
        accessToken: "expired",
        attemptId: "attempt_123",
        state: "state_123",
      })
    ).rejects.toThrow("Native auth token expired");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(netFetchMock).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const { netFetchMock } = vi.hoisted(() => ({
  netFetchMock: vi.fn(),
}));

vi.mock("electron", () => ({
  net: {
    fetch: netFetchMock,
  },
}));

vi.mock("../../app-url", () => ({
  createAppUrl: (path: string) => new URL(path, "https://lightfast.localhost"),
}));

const { createDesktopNativeAuthClient } = await import("../app-client");

afterEach(() => {
  vi.clearAllMocks();
});

describe("createDesktopNativeAuthClient", () => {
  it("uses Electron net.fetch by default", async () => {
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
});

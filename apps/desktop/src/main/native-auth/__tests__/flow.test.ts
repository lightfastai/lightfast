import { beforeEach, describe, expect, it, vi } from "vitest";

const openExternalMock = vi.fn(async () => undefined);
const setSessionMock = vi.fn(() => true);
const getSessionMock = vi.fn(() => null);
const createDesktopNativeAuthClientMock = vi.fn();
const startLoopbackServerMock = vi.fn();
const exchangeAuthorizationCodeMock = vi.fn();

vi.mock("electron", () => ({
  shell: { openExternal: openExternalMock },
}));

vi.mock("@repo/native-auth-node", async () => {
  const actual = await vi.importActual<typeof import("@repo/native-auth-node")>(
    "@repo/native-auth-node"
  );
  return {
    ...actual,
    createCodeVerifier: () => "verifier",
    createStateNonce: () => "nonce_1234567890",
    buildCodeChallenge: () => "challenge",
    startLoopbackServer: startLoopbackServerMock,
    exchangeAuthorizationCode: exchangeAuthorizationCodeMock,
  };
});

vi.mock("../app-client", () => ({
  createDesktopNativeAuthClient: createDesktopNativeAuthClientMock,
}));

vi.mock("../store", () => ({
  getSession: getSessionMock,
  setSession: setSessionMock,
}));

vi.mock("../../runtime-config", () => ({
  getRuntimeConfig: () => ({ appOrigin: "https://app.lightfast.test" }),
}));

const { beginSignIn } = await import("../flow");

describe("desktop native auth flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockReturnValue(null);
    createDesktopNativeAuthClientMock.mockReturnValue({
      getOAuthConfig: vi.fn(async () => ({
        authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
        client: "desktop",
        clientId: "desktop_client_test",
        issuer: "https://clerk.example.com",
        scopes: ["openid", "profile", "email", "offline_access"],
        supportsDynamicLoopbackPort: true,
        tokenEndpoint: "https://clerk.example.com/oauth/token",
      })),
      finalize: vi.fn(async () => ({
        client: "desktop",
        organization: { id: "org_1", name: "Acme", slug: "acme" },
        user: { email: "dev@example.com", id: "user_1" },
      })),
    });
    exchangeAuthorizationCodeMock.mockResolvedValue({
      accessToken: "access",
      expiresAt: 4_102_444_800_000,
      refreshToken: "refresh",
      tokenType: "Bearer",
    });
  });

  it("opens /native-auth/desktop/start and persists full org-bound session", async () => {
    const state = Buffer.from(
      JSON.stringify({
        attemptId: "attempt_123456789",
        nonce: "nonce_1234567890",
      }),
      "utf8"
    ).toString("base64url");
    const close = vi.fn(async () => undefined);
    startLoopbackServerMock.mockResolvedValueOnce({
      close,
      port: 54_321,
      waitForCallback: vi.fn(async () => ({ code: "code_123", state })),
    });

    await expect(beginSignIn()).resolves.toBe("access");

    const openCalls = openExternalMock.mock.calls as unknown as Array<[string]>;
    const signinUrl = new URL(openCalls[0]?.[0] ?? "");
    expect(signinUrl.pathname).toBe("/native-auth/desktop/start");
    expect(signinUrl.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:54321/callback"
    );
    expect(signinUrl.searchParams.get("state")).toBe("nonce_1234567890");
    expect(exchangeAuthorizationCodeMock).toHaveBeenCalledWith({
      code: "code_123",
      codeVerifier: "verifier",
      config: expect.objectContaining({ client: "desktop" }),
      redirectUri: "http://127.0.0.1:54321/callback",
    });
    expect(setSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: "desktop",
        organization: { id: "org_1", name: "Acme", slug: "acme" },
        tokens: expect.objectContaining({ accessToken: "access" }),
      })
    );
    expect(close).toHaveBeenCalledOnce();
  });
});

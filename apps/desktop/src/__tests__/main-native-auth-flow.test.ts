import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openExternalMock = vi.fn(async () => undefined);
const setSessionMock = vi.fn((_session: unknown) => true);
const getSessionMock = vi.fn(() => null);
const getAuthSnapshotMock = vi.fn(
  (): {
    isSignedIn: boolean;
    organizationId?: string;
    organizationName?: string;
    organizationSlug?: string | null;
    userEmail?: string | null;
  } => ({ isSignedIn: false })
);
const createDesktopNativeAuthClientMock = vi.fn();
const startLoopbackServerMock = vi.fn();
const exchangeAuthorizationCodeMock = vi.fn();

vi.mock("electron", () => ({
  app: {
    isPackaged: true,
  },
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

vi.mock("../main/native-auth/app-client", () => ({
  createDesktopNativeAuthClient: createDesktopNativeAuthClientMock,
}));

vi.mock("../main/native-auth/store", () => ({
  getAuthSnapshot: getAuthSnapshotMock,
  getSession: getSessionMock,
  setSession: setSessionMock,
}));

vi.mock("../main/runtime-config", () => ({
  getRuntimeConfig: () => ({ appOrigin: "https://app.lightfast.test" }),
}));

const { beginSignIn } = await import("../main/native-auth/flow");
const { NativeAuthError } = await import("@repo/native-auth-node");

describe("desktop native auth flow", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockReturnValue(null);
    getAuthSnapshotMock.mockReturnValue({ isSignedIn: false });
    setSessionMock.mockImplementation((session: unknown) => {
      const nativeSession = session as {
        organization: { id: string; name: string; slug?: string | null };
        user: { email?: string | null };
      };
      getAuthSnapshotMock.mockReturnValue({
        isSignedIn: true,
        organizationId: nativeSession.organization.id,
        organizationName: nativeSession.organization.name,
        organizationSlug: nativeSession.organization.slug,
        userEmail: nativeSession.user.email,
      });
      return true;
    });
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

  it("opens /oauth/desktop/start and persists full org-bound session", async () => {
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

    await expect(beginSignIn()).resolves.toMatchObject({
      isSignedIn: true,
      organizationId: "org_1",
      organizationName: "Acme",
      organizationSlug: "acme",
      userEmail: "dev@example.com",
    });

    const openCalls = openExternalMock.mock.calls as unknown as [string][];
    const signinUrl = new URL(openCalls[0]?.[0] ?? "");
    expect(signinUrl.pathname).toBe("/oauth/desktop/start");
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

  it.each([
    ["missing organization", "Native auth organization required"],
    ["wrong organization", "Native auth organization mismatch"],
  ])("returns a signed-out snapshot when finalize rejects %s", async (_name, message) => {
    const state = Buffer.from(
      JSON.stringify({
        attemptId: "attempt_123456789",
        nonce: "nonce_1234567890",
      }),
      "utf8"
    ).toString("base64url");
    const close = vi.fn(async () => undefined);
    const finalize = vi.fn(async () => {
      throw new Error(message);
    });
    createDesktopNativeAuthClientMock.mockReturnValueOnce({
      getOAuthConfig: vi.fn(async () => ({
        authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
        client: "desktop",
        clientId: "desktop_client_test",
        issuer: "https://clerk.example.com",
        scopes: ["openid", "profile", "email", "offline_access"],
        supportsDynamicLoopbackPort: true,
        tokenEndpoint: "https://clerk.example.com/oauth/token",
      })),
      finalize,
    });
    startLoopbackServerMock.mockResolvedValueOnce({
      close,
      port: 54_321,
      waitForCallback: vi.fn(async () => ({ code: "code_123", state })),
    });

    await expect(beginSignIn()).resolves.toEqual({ isSignedIn: false });
    expect(setSessionMock).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns a signed-out snapshot when token exchange yields an expired token", async () => {
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
    exchangeAuthorizationCodeMock.mockResolvedValueOnce({
      accessToken: "expired",
      expiresAt: 0,
      refreshToken: "refresh",
      tokenType: "Bearer",
    });

    await expect(beginSignIn()).resolves.toEqual({ isSignedIn: false });
    expect(setSessionMock).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("emits structured agent failure reasons for loopback timeouts", async () => {
    const stdout = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    vi.stubEnv("LIGHTFAST_DESKTOP_AGENT_MODE", "1");
    const close = vi.fn(async () => undefined);
    startLoopbackServerMock.mockResolvedValueOnce({
      close,
      port: 54_321,
      waitForCallback: vi.fn(async () => {
        throw new NativeAuthError(
          "OAUTH_TIMEOUT",
          "Timed out waiting for the browser authentication callback."
        );
      }),
    });

    await expect(beginSignIn()).resolves.toEqual({ isSignedIn: false });

    const events = stdout.mock.calls.map(([line]) =>
      JSON.parse(String(line))
    ) as Array<{ event: string; reason?: string }>;
    expect(events).toContainEqual({
      event: "auth_signin_failed",
      reason: "timeout",
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("does not let loopback close failures escape sign-in", async () => {
    const state = Buffer.from(
      JSON.stringify({
        attemptId: "attempt_123456789",
        nonce: "nonce_1234567890",
      }),
      "utf8"
    ).toString("base64url");
    const close = vi.fn(async () => {
      throw new Error("close failed");
    });
    startLoopbackServerMock.mockResolvedValueOnce({
      close,
      port: 54_321,
      waitForCallback: vi.fn(async () => ({ code: "code_123", state })),
    });

    await expect(beginSignIn()).resolves.toMatchObject({
      isSignedIn: true,
      organizationId: "org_1",
    });
    expect(close).toHaveBeenCalledOnce();
  });
});

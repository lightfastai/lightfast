import type {
  NativeOAuthConfig,
  NativeSession,
} from "@repo/native-auth-contract";
import { describe, expect, it, vi } from "vitest";

import { getValidAccessToken } from "../session";

const config = {
  authorizationEndpoint: "https://clerk.example.com/oauth/authorize",
  client: "cli",
  clientId: "cli_client_test",
  issuer: "https://clerk.example.com",
  scopes: ["openid", "profile", "email"],
  supportsDynamicLoopbackPort: true,
  tokenEndpoint: "https://clerk.example.com/oauth/token",
} satisfies NativeOAuthConfig;

function createStore(session: NativeSession | null) {
  return {
    get: vi.fn(async () => session),
    set: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  };
}

const storedSession = {
  appUrl: "https://app.lightfast.test",
  client: "cli",
  oauth: { clientId: "cli_client_test", issuer: "https://clerk.example.com" },
  organization: { id: "org_1", name: "Acme", slug: "acme" },
  schemaVersion: 2,
  tokens: {
    accessToken: "access",
    expiresAt: 10_000,
    refreshToken: "refresh",
    tokenType: "Bearer" as const,
  },
  user: { email: "dev@example.com", id: "user_1" },
} satisfies NativeSession;

describe("native auth session helpers", () => {
  it("returns the current access token when it is still valid", async () => {
    const store = createStore({
      ...storedSession,
      tokens: { ...storedSession.tokens, expiresAt: 120_001 },
    });

    await expect(
      getValidAccessToken({
        appUrl: "https://app.lightfast.test",
        config,
        now: () => 60_000,
        store,
      })
    ).resolves.toBe("access");
    expect(store.set).not.toHaveBeenCalled();
  });

  it("refreshes and persists expired access tokens", async () => {
    const store = createStore(storedSession);
    const refresh = vi.fn(async () => ({
      accessToken: "new-access",
      expiresAt: 4_102_444_800_000,
      refreshToken: "new-refresh",
      tokenType: "Bearer" as const,
    }));

    await expect(
      getValidAccessToken({
        appUrl: "https://app.lightfast.test",
        config,
        now: () => 60_000,
        refresh,
        store,
      })
    ).resolves.toBe("new-access");
    expect(refresh).toHaveBeenCalledWith({
      config,
      refreshToken: "refresh",
    });
    expect(store.set).toHaveBeenCalledWith({
      ...storedSession,
      tokens: {
        accessToken: "new-access",
        expiresAt: 4_102_444_800_000,
        refreshToken: "new-refresh",
        tokenType: "Bearer",
      },
    });
  });

  it("refuses to refresh sessions for a different app or OAuth client", async () => {
    await expect(
      getValidAccessToken({
        appUrl: "https://other.lightfast.test",
        config,
        store: createStore(storedSession),
      })
    ).rejects.toMatchObject({ code: "SESSION_MISMATCH" });

    await expect(
      getValidAccessToken({
        appUrl: "https://app.lightfast.test",
        config: { ...config, clientId: "other_client" },
        store: createStore(storedSession),
      })
    ).rejects.toMatchObject({ code: "SESSION_MISMATCH" });
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: { getPath: () => "/tmp/lightfast-desktop-auth-test" },
  safeStorage: {
    decryptString: () => "{}",
    encryptString: () => Buffer.from("encrypted"),
    isEncryptionAvailable: () => true,
  },
}));

const { getValidAuthRequestHeaders } = await import("../session");

const session = {
  appUrl: "https://app.lightfast.test",
  client: "desktop" as const,
  oauth: { clientId: "desktop_client_test", issuer: "https://clerk.example.com" },
  organization: { id: "org_1", name: "Acme", slug: "acme" },
  schemaVersion: 2 as const,
  tokens: {
    accessToken: "access",
    expiresAt: 120_001,
    refreshToken: "refresh",
    tokenType: "Bearer" as const,
  },
  user: { email: "dev@example.com", id: "user_1" },
};

describe("desktop native auth session", () => {
  it("builds native request headers for valid sessions", async () => {
    await expect(
      getValidAuthRequestHeaders({
        getSession: () => session,
        now: () => 60_000,
      })
    ).resolves.toEqual({
      Authorization: "Bearer access",
      "x-lightfast-native-client": "desktop",
      "x-lightfast-organization-id": "org_1",
    });
  });

  it("refreshes expiring access tokens and preserves organization metadata", async () => {
    const setSession = vi.fn();
    const refreshAccessToken = vi.fn(async () => ({
      accessToken: "new-access",
      expiresAt: 4_102_444_800_000,
      refreshToken: "new-refresh",
      tokenType: "Bearer" as const,
    }));

    await expect(
      getValidAuthRequestHeaders({
        getSession: () => ({
          ...session,
          tokens: { ...session.tokens, expiresAt: 1 },
        }),
        now: () => 60_000,
        refreshAccessToken,
        setSession,
      })
    ).resolves.toMatchObject({ Authorization: "Bearer new-access" });
    expect(setSession).toHaveBeenCalledWith(
      expect.objectContaining({
        organization: session.organization,
        tokens: expect.objectContaining({ accessToken: "new-access" }),
      })
    );
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: () => "/tmp/lightfast-desktop-auth-test",
  },
  safeStorage: {
    decryptString: () => "{}",
    encryptString: () => Buffer.from("encrypted"),
    isEncryptionAvailable: () => true,
  },
}));

const session = {
  appUrl: "https://app.lightfast.test",
  client: "desktop" as const,
  oauth: {
    clientId: "desktop_client_test",
    issuer: "https://clerk.example.com",
  },
  organization: { id: "org_1", name: "Acme", slug: "acme" },
  schemaVersion: 2 as const,
  tokens: {
    accessToken: "access",
    expiresAt: 4_102_444_800_000,
    refreshToken: "refresh",
    tokenType: "Bearer" as const,
  },
  user: { email: "dev@example.com", id: "user_1" },
};

describe("syncNativeSessionProfile", () => {
  it("reconciles legacy signed-in sessions with native profile metadata", async () => {
    const setSession = vi.fn(() => true);
    const sessionClient = vi.fn(async () => ({
      client: "desktop" as const,
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: {
        email: "dev@example.com",
        id: "user_1",
        imageUrl: "https://img.example.com/user_1.png",
        initials: "JP",
        username: "jeevanpillay",
      },
    }));

    const { syncNativeSessionProfile } = await import(
      "../main/native-auth/profile-sync"
    );

    await expect(
      syncNativeSessionProfile({
        client: { session: sessionClient },
        getSession: () => session,
        setSession,
      })
    ).resolves.toBe(true);

    expect(sessionClient).toHaveBeenCalledWith({
      accessToken: "access",
      organizationId: "org_1",
    });
    expect(setSession).toHaveBeenCalledWith({
      ...session,
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: {
        email: "dev@example.com",
        id: "user_1",
        imageUrl: "https://img.example.com/user_1.png",
        initials: "JP",
        username: "jeevanpillay",
      },
    });
  });

  it("updates existing sessions when server profile metadata changes", async () => {
    const setSession = vi.fn(() => true);
    const sessionClient = vi.fn(async () => ({
      client: "desktop" as const,
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: {
        email: "dev@example.com",
        id: "user_1",
        initials: "JP",
        username: "jeevanpillay",
      },
    }));
    const { syncNativeSessionProfile } = await import(
      "../main/native-auth/profile-sync"
    );

    await expect(
      syncNativeSessionProfile({
        client: { session: sessionClient },
        getSession: () => ({
          ...session,
          user: {
            ...session.user,
            initials: "JP",
            username: "oldusername",
          },
        }),
        setSession,
      })
    ).resolves.toBe(true);

    expect(setSession).toHaveBeenCalledWith({
      ...session,
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: {
        email: "dev@example.com",
        id: "user_1",
        initials: "JP",
        username: "jeevanpillay",
      },
    });
  });

  it("does not rewrite sessions when server profile metadata is unchanged", async () => {
    const setSession = vi.fn(() => true);
    const sessionClient = vi.fn(async () => ({
      client: "desktop" as const,
      organization: { id: "org_1", name: "Acme", slug: "acme" },
      user: {
        email: "dev@example.com",
        id: "user_1",
        initials: "JP",
        username: "jeevanpillay",
      },
    }));
    const { syncNativeSessionProfile } = await import(
      "../main/native-auth/profile-sync"
    );

    await expect(
      syncNativeSessionProfile({
        client: { session: sessionClient },
        getSession: () => ({
          ...session,
          user: {
            ...session.user,
            initials: "JP",
            username: "jeevanpillay",
          },
        }),
        setSession,
      })
    ).resolves.toBe(false);

    expect(sessionClient).toHaveBeenCalledOnce();
    expect(setSession).not.toHaveBeenCalled();
  });
});

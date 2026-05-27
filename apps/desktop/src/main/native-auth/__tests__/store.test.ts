import { existsSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

let encrypted = "";

vi.mock("electron", () => ({
  app: {
    getPath: () => "/tmp/lightfast-desktop-auth-test",
  },
  safeStorage: {
    decryptString: () => encrypted,
    encryptString: (plain: string) => {
      encrypted = plain;
      return Buffer.from("encrypted");
    },
    isEncryptionAvailable: () => true,
  },
}));

const { createNativeSessionStore } = await import("../store");

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

describe("desktop native auth store", () => {
  beforeEach(() => {
    encrypted = "";
  });

  it("stores full native sessions and purges pre-migration token-only payloads", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lightfast-desktop-auth-"));
    const file = join(dir, "auth.bin");
    const store = createNativeSessionStore(file);

    expect(store.setSession(session)).toBe(true);
    expect(store.getSession()).toEqual(session);

    encrypted = JSON.stringify({ token: "legacy", savedAt: Date.now() });
    await writeFile(file, "legacy", "utf8");
    store.clearMemory();
    expect(store.getSession()).toBeNull();
    expect(existsSync(file)).toBe(false);
  });

  it("returns false instead of throwing for invalid sessions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lightfast-desktop-auth-"));
    const file = join(dir, "auth.bin");
    const store = createNativeSessionStore(file);

    expect(store.setSession({ ...session, client: "cli" } as never)).toBe(
      false
    );
    expect(store.getSession()).toBeNull();
  });

  it("clears in-memory auth even when persisted session purge fails", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lightfast-desktop-auth-"));
    const file = join(dir, "auth.bin");
    const store = createNativeSessionStore(file);

    expect(store.setSession(session)).toBe(true);
    rmSync(file);
    await mkdir(file);

    expect(store.signOut()).toBe(false);
    expect(store.getSession()).toBeNull();
  });
});

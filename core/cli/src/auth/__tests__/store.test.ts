import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { NativeSession } from "@repo/native-auth-contract";
import { describe, expect, it, vi } from "vitest";

import { SessionStore } from "../store";

const session = {
  appUrl: "https://app.lightfast.test",
  client: "cli",
  oauth: { clientId: "cli_client_test", issuer: "https://clerk.example.com" },
  organization: { id: "org_1", name: "Acme", slug: "acme" },
  schemaVersion: 2,
  tokens: {
    accessToken: "access",
    expiresAt: 4_102_444_800_000,
    refreshToken: "refresh",
    tokenType: "Bearer" as const,
  },
  user: { email: "dev@example.com", id: "user_1" },
} satisfies NativeSession;

describe("SessionStore", () => {
  it("returns null when auth.json is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lightfast-cli-"));
    await expect(new SessionStore(join(dir, "auth.json")).get()).resolves.toBe(
      null
    );
  });

  it("sets, gets, and clears auth.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lightfast-cli-"));
    const store = new SessionStore(join(dir, "nested", "auth.json"));

    await store.set(session);
    await expect(store.get()).resolves.toEqual(session);

    await store.clear();
    await expect(store.get()).resolves.toBe(null);
  });

  it("uses collision-safe temp paths for concurrent writes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lightfast-cli-"));
    const store = new SessionStore(join(dir, "auth.json"));
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1);

    try {
      await expect(
        Promise.all([store.set(session), store.set(session)])
      ).resolves.toHaveLength(2);
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("throws for invalid stored JSON", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lightfast-cli-"));
    const file = join(dir, "auth.json");
    await writeFile(file, "{bad", "utf8");

    await expect(new SessionStore(file).get()).rejects.toThrow();
  });
});

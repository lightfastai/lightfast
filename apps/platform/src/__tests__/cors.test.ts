import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function setupMocks(opts: {
  appUrl: string;
  vercelEnv: "development" | "preview" | "production" | undefined;
  platformUrl?: string;
  wwwUrl?: string;
}) {
  vi.doMock("~/origins", () => ({
    appUrl: opts.appUrl,
    wwwUrl: opts.wwwUrl ?? "https://www.lightfast.localhost",
    platformUrl: opts.platformUrl ?? "https://platform.lightfast.localhost",
  }));
  vi.doMock("~/env", () => ({
    env: { NEXT_PUBLIC_VERCEL_ENV: opts.vercelEnv },
  }));
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock("~/origins");
  vi.doUnmock("~/env");
  vi.unstubAllEnvs();
});

describe("platform isAllowedWebOrigin", () => {
  it("admits app origin in production", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://lightfast.ai")).toBe(true);
  });

  it("admits the exact direct local app origin in dev", async () => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost",
      wwwUrl: "https://www.lightfast.localhost",
      platformUrl: "https://platform.lightfast.localhost",
      vercelEnv: undefined,
    });
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://app.lightfast.localhost")).toBe(true);
  });

  it("rejects direct local www and platform origins in dev", async () => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost",
      wwwUrl: "https://www.lightfast.localhost",
      platformUrl: "https://platform.lightfast.localhost",
      vercelEnv: undefined,
    });
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://www.lightfast.localhost")).toBe(false);
    expect(isAllowedWebOrigin("https://platform.lightfast.localhost")).toBe(
      false
    );
  });

  it("does not wildcard uninjected worktree origins", async () => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost",
      wwwUrl: "https://www.lightfast.localhost",
      platformUrl: "https://platform.lightfast.localhost",
      vercelEnv: undefined,
    });
    const { isAllowedWebOrigin } = await import("~/cors");
    expect(isAllowedWebOrigin("https://feature.app.lightfast.localhost")).toBe(
      false
    );
  });

  it("throws if appUrl resolves to production URL in dev", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: undefined });
    await expect(import("~/cors")).rejects.toThrow(
      /portless daemon likely not running/
    );
  });
});

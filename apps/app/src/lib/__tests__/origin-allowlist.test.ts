import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PORTLESS_ORIGINS = [
  "lightfast.localhost",
  "*.lightfast.localhost",
  "app.lightfast.localhost",
  "*.app.lightfast.localhost",
  "www.lightfast.localhost",
  "*.www.lightfast.localhost",
];

function setupMocks(opts: {
  appUrl: string;
  vercelEnv: "development" | "preview" | "production" | undefined;
  origins?: string[];
}) {
  vi.doMock("~/lib/related-projects", () => ({ appUrl: opts.appUrl }));
  vi.doMock("~/env", () => ({
    env: { NEXT_PUBLIC_VERCEL_ENV: opts.vercelEnv },
  }));
  vi.doMock("@lightfastai/dev-proxy/next", () => ({
    getPortlessProxyOrigins: vi.fn(() => opts.origins ?? PORTLESS_ORIGINS),
  }));
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock("~/lib/related-projects");
  vi.doUnmock("~/env");
  vi.doUnmock("@lightfastai/dev-proxy/next");
});

describe("isAllowedOrigin (dev)", () => {
  beforeEach(() => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost/",
      vercelEnv: undefined,
    });
  });

  it("admits the canonical app origin (matches even though appUrl has trailing slash)", async () => {
    const { isAllowedOrigin } = await import("../origin-allowlist");
    expect(isAllowedOrigin("https://app.lightfast.localhost")).toBe(true);
  });

  it("admits the bare wildcard host", async () => {
    const { isAllowedOrigin } = await import("../origin-allowlist");
    expect(isAllowedOrigin("https://www.lightfast.localhost")).toBe(true);
  });

  it("admits a worktree-prefixed app origin via *.app.lightfast.localhost", async () => {
    const { isAllowedOrigin } = await import("../origin-allowlist");
    expect(isAllowedOrigin("https://feature.app.lightfast.localhost")).toBe(
      true
    );
  });

  it("rejects an unrelated origin", async () => {
    const { isAllowedOrigin } = await import("../origin-allowlist");
    expect(isAllowedOrigin("https://evil.com")).toBe(false);
  });

  it("rejects null/empty", async () => {
    const { isAllowedOrigin } = await import("../origin-allowlist");
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin("")).toBe(false);
  });

  it("rejects malformed origin strings", async () => {
    const { isAllowedOrigin } = await import("../origin-allowlist");
    expect(isAllowedOrigin("not-a-url")).toBe(false);
  });
});

describe("isAllowedOrigin (production)", () => {
  beforeEach(() => {
    setupMocks({
      appUrl: "https://lightfast.ai",
      vercelEnv: "production",
    });
  });

  it("admits only the canonical appUrl in non-dev", async () => {
    const { isAllowedOrigin } = await import("../origin-allowlist");
    expect(isAllowedOrigin("https://lightfast.ai")).toBe(true);
  });

  it("rejects portless wildcard origins in non-dev", async () => {
    const { isAllowedOrigin } = await import("../origin-allowlist");
    expect(isAllowedOrigin("https://app.lightfast.localhost")).toBe(false);
    expect(isAllowedOrigin("https://feature.app.lightfast.localhost")).toBe(
      false
    );
  });
});

describe("cold-start guard", () => {
  it("throws if appUrl resolved to production URL while in dev", async () => {
    setupMocks({
      appUrl: "https://lightfast.ai",
      vercelEnv: undefined,
    });
    await expect(import("../origin-allowlist")).rejects.toThrow(
      /portless daemon likely not running/
    );
  });
});

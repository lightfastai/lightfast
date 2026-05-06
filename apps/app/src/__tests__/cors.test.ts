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
  vi.doMock("~/origins", () => ({
    appUrl: opts.appUrl,
    devOriginPatterns: opts.origins ?? PORTLESS_ORIGINS,
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
});

describe("isAllowedOrigin (dev)", () => {
  beforeEach(() => {
    setupMocks({
      appUrl: "https://app.lightfast.localhost/",
      vercelEnv: undefined,
    });
  });

  it("admits the canonical app origin (matches even though appUrl has trailing slash)", async () => {
    const { isAllowedOrigin } = await import("../cors");
    expect(isAllowedOrigin("https://app.lightfast.localhost")).toBe(true);
  });

  it("admits the bare wildcard host", async () => {
    const { isAllowedOrigin } = await import("../cors");
    expect(isAllowedOrigin("https://www.lightfast.localhost")).toBe(true);
  });

  it("admits a worktree-prefixed app origin via *.app.lightfast.localhost", async () => {
    const { isAllowedOrigin } = await import("../cors");
    expect(isAllowedOrigin("https://feature.app.lightfast.localhost")).toBe(
      true
    );
  });

  it("rejects an unrelated origin", async () => {
    const { isAllowedOrigin } = await import("../cors");
    expect(isAllowedOrigin("https://evil.com")).toBe(false);
  });

  it("rejects null/empty", async () => {
    const { isAllowedOrigin } = await import("../cors");
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin("")).toBe(false);
  });

  it("rejects malformed origin strings", async () => {
    const { isAllowedOrigin } = await import("../cors");
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
    const { isAllowedOrigin } = await import("../cors");
    expect(isAllowedOrigin("https://lightfast.ai")).toBe(true);
  });

  it("rejects portless wildcard origins in non-dev", async () => {
    const { isAllowedOrigin } = await import("../cors");
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
    await expect(import("../cors")).rejects.toThrow(
      /portless daemon likely not running/
    );
  });
});

describe("isDesktopDevOrigin", () => {
  it("admits localhost in dev", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setupMocks({
      appUrl: "https://app.lightfast.localhost/",
      vercelEnv: undefined,
    });
    const { isDesktopDevOrigin } = await import("../cors");
    expect(isDesktopDevOrigin("http://localhost:5173")).toBe(true);
    expect(isDesktopDevOrigin("https://localhost:5173")).toBe(true);
    vi.unstubAllEnvs();
  });

  it("rejects localhost outside dev", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isDesktopDevOrigin } = await import("../cors");
    expect(isDesktopDevOrigin("http://localhost:5173")).toBe(false);
    vi.unstubAllEnvs();
  });

  it("rejects null and non-localhost", async () => {
    vi.stubEnv("NODE_ENV", "development");
    setupMocks({
      appUrl: "https://app.lightfast.localhost/",
      vercelEnv: undefined,
    });
    const { isDesktopDevOrigin } = await import("../cors");
    expect(isDesktopDevOrigin(null)).toBe(false);
    expect(isDesktopDevOrigin("https://evil.com")).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("isPackagedDesktopRequest", () => {
  it("admits Origin: 'null' (string) + marker header == '1'", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isPackagedDesktopRequest } = await import("../cors");
    const headers = new Headers({ "x-lightfast-desktop": "1" });
    expect(isPackagedDesktopRequest("null", headers)).toBe(true);
  });

  it("rejects when Origin is a real URL even with marker", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isPackagedDesktopRequest } = await import("../cors");
    const headers = new Headers({ "x-lightfast-desktop": "1" });
    expect(isPackagedDesktopRequest("https://lightfast.ai", headers)).toBe(
      false
    );
    expect(isPackagedDesktopRequest("https://evil.com", headers)).toBe(false);
  });

  it("rejects absent Origin header (JS null) — only string 'null' qualifies", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isPackagedDesktopRequest } = await import("../cors");
    const headers = new Headers({ "x-lightfast-desktop": "1" });
    expect(isPackagedDesktopRequest(null, headers)).toBe(false);
  });

  it("rejects when marker header is missing or not exactly '1'", async () => {
    setupMocks({ appUrl: "https://lightfast.ai", vercelEnv: "production" });
    const { isPackagedDesktopRequest } = await import("../cors");
    expect(isPackagedDesktopRequest("null", new Headers())).toBe(false);
    expect(
      isPackagedDesktopRequest(
        "null",
        new Headers({ "x-lightfast-desktop": "0" })
      )
    ).toBe(false);
    expect(
      isPackagedDesktopRequest(
        "null",
        new Headers({ "x-lightfast-desktop": "true" })
      )
    ).toBe(false);
  });
});

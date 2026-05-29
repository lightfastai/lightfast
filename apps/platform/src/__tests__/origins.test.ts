import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Env {
  appUrl?: string;
  platformUrl?: string;
  vercelEnv?: "development" | "preview" | "production";
  wwwUrl?: string;
}

function mockEnv(opts: Env) {
  vi.doMock("~/env", () => ({
    env: {
      NEXT_PUBLIC_VERCEL_ENV: opts.vercelEnv ?? "development",
      NEXT_PUBLIC_APP_URL: opts.appUrl ?? "https://lightfast.ai",
      NEXT_PUBLIC_WWW_URL: opts.wwwUrl ?? "https://lightfast.ai",
      NEXT_PUBLIC_PLATFORM_URL:
        opts.platformUrl ?? "https://lightfast-platform.vercel.app",
    },
  }));
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock("~/env");
  vi.unstubAllEnvs();
});

describe("platform origins", () => {
  it("exports direct local portless URLs from env", async () => {
    mockEnv({
      appUrl: "https://app.lightfast.localhost",
      wwwUrl: "https://www.lightfast.localhost",
      platformUrl: "https://platform.lightfast.localhost",
    });

    const origins = await import("../origins");

    expect(origins.appUrl).toBe("https://app.lightfast.localhost");
    expect(origins.wwwUrl).toBe("https://www.lightfast.localhost");
    expect(origins.platformUrl).toBe("https://platform.lightfast.localhost");
    expect("devOriginPatterns" in origins).toBe(false);
  });

  it("keeps localhost ports in direct URL exports", async () => {
    mockEnv({
      appUrl: "http://localhost:3000",
      wwwUrl: "http://localhost:3001",
      platformUrl: "http://localhost:3002",
    });

    const { appUrl, wwwUrl, platformUrl } = await import("../origins");

    expect(appUrl).toBe("http://localhost:3000");
    expect(wwwUrl).toBe("http://localhost:3001");
    expect(platformUrl).toBe("http://localhost:3002");
  });
});

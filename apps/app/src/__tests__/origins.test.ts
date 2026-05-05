import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PORTLESS_PATTERNS = [
  "lightfast.localhost",
  "*.lightfast.localhost",
  "app.lightfast.localhost",
  "*.app.lightfast.localhost",
  "www.lightfast.localhost",
  "*.www.lightfast.localhost",
];

function setupModuleMocks() {
  vi.doMock("@lightfastai/dev-proxy/projects", () => ({
    resolveProjectUrl: vi.fn((name: string) => {
      if (name === "lightfast-app") return "https://app.lightfast.localhost";
      if (name === "lightfast-www") return "https://www.lightfast.localhost";
      throw new Error(`unexpected project name: ${name}`);
    }),
  }));
  vi.doMock("@lightfastai/dev-proxy/next", () => ({
    getPortlessProxyOrigins: vi.fn(() => PORTLESS_PATTERNS),
  }));
}

function mockEnv(vercelEnv: "development" | "preview" | "production" | undefined) {
  vi.doMock("~/env", () => ({
    env: { NEXT_PUBLIC_VERCEL_ENV: vercelEnv },
  }));
}

beforeEach(() => {
  vi.resetModules();
  setupModuleMocks();
});

afterEach(() => {
  vi.doUnmock("@lightfastai/dev-proxy/projects");
  vi.doUnmock("@lightfastai/dev-proxy/next");
  vi.doUnmock("~/env");
  vi.unstubAllEnvs();
});

describe("origins (dev — NEXT_PUBLIC_VERCEL_ENV undefined)", () => {
  beforeEach(() => {
    mockEnv(undefined);
  });

  it("appUrl resolves to the portless self URL", async () => {
    const { appUrl } = await import("../origins");
    expect(appUrl).toBe("https://app.lightfast.localhost");
  });

  it("wwwUrl resolves to the portless sibling URL", async () => {
    const { wwwUrl } = await import("../origins");
    expect(wwwUrl).toBe("https://www.lightfast.localhost");
  });

  it("platformUrl is the raw localhost backend (not on portless)", async () => {
    const { platformUrl } = await import("../origins");
    expect(platformUrl).toBe("http://localhost:4112");
  });

  it("devOriginPatterns is the portless origin set", async () => {
    const { devOriginPatterns } = await import("../origins");
    expect(devOriginPatterns).toEqual(PORTLESS_PATTERNS);
  });
});

describe("origins (production — VRP unset)", () => {
  beforeEach(() => {
    mockEnv("production");
    vi.stubEnv("VERCEL_ENV", "production");
  });

  it("appUrl is the production literal", async () => {
    const { appUrl } = await import("../origins");
    expect(appUrl).toBe("https://lightfast.ai");
  });

  it("wwwUrl falls back to its production literal when VRP is empty", async () => {
    const { wwwUrl } = await import("../origins");
    expect(wwwUrl).toBe("https://lightfast.ai");
  });

  it("platformUrl falls back to its production literal when VRP is empty", async () => {
    const { platformUrl } = await import("../origins");
    expect(platformUrl).toBe("https://lightfast-platform.vercel.app");
  });

  it("devOriginPatterns is empty", async () => {
    const { devOriginPatterns } = await import("../origins");
    expect(devOriginPatterns).toEqual([]);
  });
});

describe("origins (production — VRP populated)", () => {
  beforeEach(() => {
    mockEnv("production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv(
      "VERCEL_RELATED_PROJECTS",
      JSON.stringify([
        {
          project: { name: "lightfast-www" },
          production: { alias: "lightfast.ai" },
        },
        {
          project: { name: "lightfast-platform" },
          production: { url: "lightfast-platform-prod.vercel.app" },
        },
      ])
    );
  });

  it("appUrl is defaultHost (lightfast-app is not in its own VRP)", async () => {
    const { appUrl } = await import("../origins");
    expect(appUrl).toBe("https://lightfast.ai");
  });

  it("wwwUrl uses the matched VRP alias", async () => {
    const { wwwUrl } = await import("../origins");
    expect(wwwUrl).toBe("https://lightfast.ai");
  });

  it("platformUrl uses the matched VRP url", async () => {
    const { platformUrl } = await import("../origins");
    expect(platformUrl).toBe("https://lightfast-platform-prod.vercel.app");
  });
});

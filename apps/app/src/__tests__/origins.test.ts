import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockEnv(
  vercelEnv: "development" | "preview" | "production" | undefined
) {
  vi.doMock("~/env", () => ({
    env: { NEXT_PUBLIC_VERCEL_ENV: vercelEnv },
  }));
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.doUnmock("~/env");
  vi.unstubAllEnvs();
});

describe("origins (dev — NEXT_PUBLIC_VERCEL_ENV undefined)", () => {
  beforeEach(() => {
    mockEnv(undefined);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.lightfast.localhost");
    vi.stubEnv("NEXT_PUBLIC_WWW_URL", "https://www.lightfast.localhost");
    vi.stubEnv(
      "NEXT_PUBLIC_PLATFORM_URL",
      "https://platform.lightfast.localhost"
    );
  });

  it("appUrl resolves to the injected portless self URL", async () => {
    const { appUrl } = await import("../origins");
    expect(appUrl).toBe("https://app.lightfast.localhost");
  });

  it("wwwUrl resolves to the injected portless sibling URL", async () => {
    const { wwwUrl } = await import("../origins");
    expect(wwwUrl).toBe("https://www.lightfast.localhost");
  });

  it("platformUrl resolves to the injected portless sibling URL", async () => {
    const { platformUrl } = await import("../origins");
    expect(platformUrl).toBe("https://platform.lightfast.localhost");
  });

  it("devOriginPatterns is the host set of the injected URLs", async () => {
    const { devOriginPatterns } = await import("../origins");
    expect(devOriginPatterns).toEqual([
      "app.lightfast.localhost",
      "www.lightfast.localhost",
      "platform.lightfast.localhost",
    ]);
  });
});

describe("origins (dev — NEXT_PUBLIC_<APP>_URL unset)", () => {
  beforeEach(() => {
    mockEnv(undefined);
  });

  it("appUrl falls back to the production literal", async () => {
    const { appUrl } = await import("../origins");
    expect(appUrl).toBe("https://lightfast.ai");
  });

  it("devOriginPatterns excludes lightfast.ai (the prod fallback)", async () => {
    const { devOriginPatterns } = await import("../origins");
    expect(devOriginPatterns).toEqual([]);
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

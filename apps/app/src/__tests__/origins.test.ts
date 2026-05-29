import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface Env {
  appUrl?: string;
  platformUrl?: string;
  vercelEnv?: "development" | "preview" | "production";
  wwwUrl?: string;
}

// Mirror the zod defaults declared in src/env.ts so the mock acts like the
// real env wrapper (which fills in defaults when the var is unset).
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

describe("origins (dev — NEXT_PUBLIC_VERCEL_ENV defaults to development)", () => {
  beforeEach(() => {
    mockEnv({
      appUrl: "https://app.lightfast.localhost",
      wwwUrl: "https://www.lightfast.localhost",
      platformUrl: "https://platform.lightfast.localhost",
    });
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

  it("does not export a generic dev origin pattern list", async () => {
    const origins = await import("../origins");
    expect("devOriginPatterns" in origins).toBe(false);
  });
});

describe("origins (dev — NEXT_PUBLIC_<APP>_URL unset)", () => {
  beforeEach(() => {
    mockEnv({});
  });

  it("appUrl falls back to the production literal", async () => {
    const { appUrl } = await import("../origins");
    expect(appUrl).toBe("https://lightfast.ai");
  });
});

describe("origins (dev — NEXT_PUBLIC_<APP>_URL with port)", () => {
  beforeEach(() => {
    mockEnv({
      appUrl: "http://localhost:3000",
      wwwUrl: "http://localhost:3001",
      platformUrl: "http://localhost:3002",
    });
  });

  it("appUrl resolves to the injected localhost URL", async () => {
    const { appUrl } = await import("../origins");
    expect(appUrl).toBe("http://localhost:3000");
  });

  it("wwwUrl resolves to the injected localhost URL", async () => {
    const { wwwUrl } = await import("../origins");
    expect(wwwUrl).toBe("http://localhost:3001");
  });

  it("platformUrl resolves to the injected localhost URL", async () => {
    const { platformUrl } = await import("../origins");
    expect(platformUrl).toBe("http://localhost:3002");
  });
});

describe("origins (production — VRP unset)", () => {
  beforeEach(() => {
    mockEnv({ vercelEnv: "production" });
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
});

describe("origins (production — VRP populated)", () => {
  beforeEach(() => {
    mockEnv({ vercelEnv: "production" });
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

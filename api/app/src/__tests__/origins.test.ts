import { afterEach, describe, expect, it, vi } from "vitest";

async function importOrigins() {
  vi.resetModules();
  return import("../origins");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("api app origins", () => {
  it("throws in local mode when local origin env vars are missing", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_WWW_URL", "");
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_URL", "");

    await expect(importOrigins()).rejects.toThrow("NEXT_PUBLIC_APP_URL");
  });

  it("uses local origin env vars in local mode", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lightfast.localhost");
    vi.stubEnv("NEXT_PUBLIC_WWW_URL", "https://www.lightfast.localhost");
    vi.stubEnv(
      "NEXT_PUBLIC_PLATFORM_URL",
      "https://platform.lightfast.localhost"
    );

    const origins = await importOrigins();

    expect(origins.appUrl).toBe("https://lightfast.localhost");
    expect(origins.wwwUrl).toBe("https://www.lightfast.localhost");
    expect(origins.platformUrl).toBe("https://platform.lightfast.localhost");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

async function importOrigins() {
  vi.resetModules();
  return import("../origins");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("api platform origins", () => {
  it("throws in local mode when NEXT_PUBLIC_APP_URL is missing", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");

    await expect(importOrigins()).rejects.toThrow("NEXT_PUBLIC_APP_URL");
  });

  it("uses the local app origin in local mode", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    vi.stubEnv("VERCEL_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.lightfast.localhost");

    const origins = await importOrigins();

    expect(origins.appUrl).toBe("https://app.lightfast.localhost");
  });
});

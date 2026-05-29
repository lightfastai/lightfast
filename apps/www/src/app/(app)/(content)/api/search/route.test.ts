import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = {
  MXBAI_API_KEY: process.env.MXBAI_API_KEY,
  MXBAI_STORE_ID: process.env.MXBAI_STORE_ID,
  SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION,
};

describe("search route", () => {
  afterEach(() => {
    restoreEnv("MXBAI_API_KEY", ORIGINAL_ENV.MXBAI_API_KEY);
    restoreEnv("MXBAI_STORE_ID", ORIGINAL_ENV.MXBAI_STORE_ID);
    restoreEnv("SKIP_ENV_VALIDATION", ORIGINAL_ENV.SKIP_ENV_VALIDATION);
    vi.resetModules();
  });

  it("does not create the Mixedbread client during module evaluation", async () => {
    delete process.env.MXBAI_API_KEY;
    delete process.env.MXBAI_STORE_ID;
    process.env.SKIP_ENV_VALIDATION = "true";
    vi.resetModules();

    await expect(import("./route")).resolves.toHaveProperty("GET");
  });

  it("returns an empty result without Mixedbread credentials for blank queries", async () => {
    delete process.env.MXBAI_API_KEY;
    delete process.env.MXBAI_STORE_ID;
    process.env.SKIP_ENV_VALIDATION = "true";
    vi.resetModules();

    const { GET } = await import("./route");
    const response = await GET(
      new NextRequest("https://www.lightfast.localhost/api/search?query=")
    );

    await expect(response.json()).resolves.toEqual([]);
  });
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

import { afterEach, describe, expect, it, vi } from "vitest";

async function importWithAppUrl(appUrl?: string) {
  vi.resetModules();
  vi.doMock("../env", () => ({
    cliEnv: {
      LIGHTFAST_APP_URL: appUrl,
    },
  }));
  return import("../auth/config");
}

afterEach(() => {
  vi.doUnmock("../env");
});

describe("getAppUrl", () => {
  it("requires an explicit app URL", async () => {
    const { getAppUrl } = await importWithAppUrl(undefined);

    expect(() => getAppUrl()).toThrow(/LIGHTFAST_APP_URL is required/);
  });

  it("removes one trailing slash from the configured app URL", async () => {
    const { getAppUrl } = await importWithAppUrl("https://app.example.test/");

    expect(getAppUrl()).toBe("https://app.example.test");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

async function importWithAppUrl(appUrl?: string) {
  vi.resetModules();
  vi.doMock("../../env/main", () => ({
    mainEnv: {
      APP_URL: appUrl,
    },
  }));
  return import("../app-origin");
}

afterEach(() => {
  vi.doUnmock("../../env/main");
});

describe("resolveDesktopAppOrigin", () => {
  it("uses APP_URL for dev builds and normalizes to origin", async () => {
    const { resolveDesktopAppOrigin } = await importWithAppUrl(
      "https://lightfast.localhost/dashboard?x=1"
    );

    expect(resolveDesktopAppOrigin("dev")).toBe("https://lightfast.localhost");
  });

  it("requires APP_URL for dev builds", async () => {
    const { resolveDesktopAppOrigin } = await importWithAppUrl(undefined);

    expect(() => resolveDesktopAppOrigin("dev")).toThrow(/APP_URL must be set/);
  });

  it("keeps packaged builds on the production app origin", async () => {
    const { resolveDesktopAppOrigin } = await importWithAppUrl(
      "https://lightfast.localhost"
    );

    expect(resolveDesktopAppOrigin("prod")).toBe("https://lightfast.ai");
  });

  it("rejects unsupported build flavors", async () => {
    const { resolveDesktopAppOrigin } = await importWithAppUrl(
      "https://lightfast.localhost"
    );

    expect(() =>
      resolveDesktopAppOrigin(
        "production" as Parameters<typeof resolveDesktopAppOrigin>[0]
      )
    ).toThrow();
  });
});
